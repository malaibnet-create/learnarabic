import { randomUUID } from 'node:crypto';
import { createServerSupabaseClient } from '../../../../lib/supabase/server';
import { countExamWords, createPublicExam, finalExamPrivate, listeningPlayMayCount } from '../../../../lib/level3-exam-server';

export const runtime = 'nodejs';

const sectionIds = ['vocabulary', 'reading', 'listening', 'grammar', 'writing', 'speaking'] as const;
const objectiveIds = new Set(finalExamPrivate.exam.sections.slice(0, 4).map((section) => section.id));
const publicQuestions = createPublicExam('validation').questions;
const questionById: ReadonlyMap<string, (typeof publicQuestions)[number]> = new Map(
  publicQuestions.map((question) => [question.id, question]),
);

function authConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

function cleanAnswers(value: unknown) {
  if (!value || typeof value !== 'object') return {} as Record<string, string>;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([id, answer]) => {
    const question = questionById.get(id);
    if (!question || typeof answer !== 'string' || !(question.options as readonly string[]).includes(answer)) return [];
    return [[id, answer.slice(0, 500)]];
  }));
}

function cleanTranscript(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(-80).flatMap((entry) => {
    if (!entry || (entry.role !== 'learner' && entry.role !== 'examiner') || typeof entry.text !== 'string') return [];
    const text = entry.text.trim().slice(0, 3000);
    return text ? [{ role: entry.role, text }] : [];
  });
}

function previewStart(body: any) {
  const attemptId = typeof body.resumeAttemptId === 'string' && body.resumeAttemptId.startsWith('preview-') ? body.resumeAttemptId : `preview-${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 90 * 60_000).toISOString();
  return Response.json({ attemptId, startedAt: new Date().toISOString(), expiresAt, attemptNumber: 1, bestScore: 0, listeningPlays: 0, submittedSections: [], publicExam: createPublicExam(attemptId), preview: true });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : 'start';
    if (!authConfigured()) {
      if (action === 'start') return previewStart(body);
      if (action === 'listening-start') return Response.json({ allowed: true, plays: Math.max(0, Math.min(2, Number(body.listeningPlays) || 0)) });
      if (action === 'listening-complete') return Response.json({ counted: true, plays: Math.min(2, (Number(body.listeningPlays) || 0) + 1) });
      return Response.json({ saved: true, preview: true });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

    if (action === 'start') {
      let active: any = null;
      if (typeof body.resumeAttemptId === 'string') {
        const { data } = await supabase.from('level3_exam_attempts').select('*').eq('id', body.resumeAttemptId).eq('user_id', user.id).maybeSingle();
        active = data;
      }
      if (!active) {
        const { data } = await supabase.from('level3_exam_attempts').select('*').eq('user_id', user.id).eq('exam_id', finalExamPrivate.exam.id).in('status', ['in_progress', 'evaluation_pending']).order('started_at', { ascending: false }).limit(1).maybeSingle();
        active = data;
      }
      if (active && new Date(active.expires_at).getTime() <= Date.now()) {
        await supabase.from('level3_exam_attempts').update({ status: 'expired', ended_at: new Date().toISOString() }).eq('id', active.id).eq('user_id', user.id);
        active = null;
      }
      if (!active) {
        const { data: previous } = await supabase.from('level3_exam_attempts').select('best_score,attempt_number').eq('user_id', user.id).eq('exam_id', finalExamPrivate.exam.id).order('attempt_number', { ascending: false }).limit(1).maybeSingle();
        const attemptId = randomUUID();
        const startedAt = new Date();
        const row = {
          id: attemptId, user_id: user.id, exam_id: finalExamPrivate.exam.id,
          started_at: startedAt.toISOString(), expires_at: new Date(startedAt.getTime() + 90 * 60_000).toISOString(),
          best_score: Number(previous?.best_score || 0), attempt_number: Number(previous?.attempt_number || 0) + 1,
        };
        const { data, error } = await supabase.from('level3_exam_attempts').insert(row).select('*').single();
        if (error) return Response.json({ error: 'EXAM_DATABASE_NOT_READY' }, { status: 503 });
        active = data;
      }
      return Response.json({
        attemptId: active.id, startedAt: active.started_at, expiresAt: active.expires_at,
        attemptNumber: active.attempt_number, bestScore: active.best_score, listeningPlays: active.listening_plays,
        submittedSections: active.submitted_sections || [], answers: active.answers || {}, writingText: active.writing_text || '',
        speakingTranscript: active.speaking_transcript || [], currentSection: active.current_section,
        publicExam: createPublicExam(active.id), preview: false,
      });
    }

    const attemptId = typeof body.attemptId === 'string' ? body.attemptId : '';
    if (!attemptId) return Response.json({ error: 'ATTEMPT_REQUIRED' }, { status: 400 });
    const { data: attempt } = await supabase.from('level3_exam_attempts').select('*').eq('id', attemptId).eq('user_id', user.id).maybeSingle();
    if (!attempt) return Response.json({ error: 'ATTEMPT_NOT_FOUND' }, { status: 404 });
    if (new Date(attempt.expires_at).getTime() <= Date.now()) return Response.json({ error: 'ATTEMPT_EXPIRED' }, { status: 409 });

    if (action === 'listening-start') {
      if (Number(attempt.listening_plays) >= 2 || (attempt.submitted_sections || []).includes('listening')) return Response.json({ error: 'LISTENING_LIMIT_REACHED' }, { status: 409 });
      const now = new Date().toISOString();
      await supabase.from('level3_exam_attempts').update({ listening_started_at: now, updated_at: now }).eq('id', attemptId).eq('user_id', user.id);
      return Response.json({ allowed: true, plays: attempt.listening_plays });
    }
    if (action === 'listening-complete') {
      const counted = listeningPlayMayCount(attempt.listening_started_at);
      const plays = counted ? Math.min(2, Number(attempt.listening_plays) + 1) : Number(attempt.listening_plays);
      await supabase.from('level3_exam_attempts').update({ listening_plays: plays, listening_started_at: null, updated_at: new Date().toISOString() }).eq('id', attemptId).eq('user_id', user.id);
      return Response.json({ counted, plays });
    }
    if (action === 'listening-cancel') {
      await supabase.from('level3_exam_attempts').update({ listening_started_at: null, updated_at: new Date().toISOString() }).eq('id', attemptId).eq('user_id', user.id);
      return Response.json({ saved: true });
    }
    if (action === 'retake-production') {
      const section = body.section === 'writing' || body.section === 'speaking' ? body.section : null;
      if (!section || attempt.status !== 'production_retake') return Response.json({ error: 'RETAKE_NOT_ALLOWED' }, { status: 409 });
      const previousEvaluation = section === 'writing' ? attempt.writing_evaluation : attempt.speaking_evaluation;
      if (Number(previousEvaluation?.score || 0) >= 8) return Response.json({ error: 'SECTION_ALREADY_PASSED' }, { status: 409 });
      const submitted = (attempt.submitted_sections || []).filter((item: string) => item !== section);
      const changes: Record<string, unknown> = {
        status: 'in_progress', ended_at: null, current_section: section, submitted_sections: submitted,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(), updated_at: new Date().toISOString(),
      };
      if (section === 'writing') { changes.writing_text = ''; changes.writing_evaluation = null; }
      else { changes.speaking_transcript = []; changes.speaking_evaluation = null; }
      await supabase.from('level3_exam_attempts').update(changes).eq('id', attemptId).eq('user_id', user.id);
      return Response.json({ saved: true, submittedSections: submitted, expiresAt: changes.expires_at });
    }

    const answers = { ...(attempt.answers || {}), ...cleanAnswers(body.answers) };
    const writingText = typeof body.writingText === 'string' ? body.writingText.slice(0, 20_000) : attempt.writing_text;
    const speakingTranscript = body.speakingTranscript ? cleanTranscript(body.speakingTranscript) : attempt.speaking_transcript;
    const currentSection = sectionIds.includes(body.currentSection) ? body.currentSection : attempt.current_section;
    let submittedSections = Array.isArray(attempt.submitted_sections) ? attempt.submitted_sections.filter((item: string) => sectionIds.includes(item as any)) : [];

    if (action === 'submit-section') {
      const section = sectionIds.includes(body.section) ? body.section : null;
      if (!section) return Response.json({ error: 'INVALID_SECTION' }, { status: 400 });
      if (objectiveIds.has(section)) {
        const required = createPublicExam(attemptId).questions.filter((question) => question.section === section);
        if (!required.every((question) => typeof answers[question.id] === 'string')) return Response.json({ error: 'SECTION_INCOMPLETE' }, { status: 409 });
      }
      if (section === 'listening' && Number(attempt.listening_plays) < 1) return Response.json({ error: 'LISTENING_REQUIRED' }, { status: 409 });
      if (section === 'writing' && (countExamWords(String(writingText || '')) < 120 || countExamWords(String(writingText || '')) > 160)) {
        return Response.json({ error: 'WRITING_WORD_COUNT' }, { status: 409 });
      }
      if (section === 'speaking' && cleanTranscript(speakingTranscript).filter((entry) => entry.role === 'learner').length < 2) {
        return Response.json({ error: 'PRODUCTION_SECTIONS_INCOMPLETE' }, { status: 409 });
      }
      if (!submittedSections.includes(section)) submittedSections = [...submittedSections, section];
    }

    const navigationEvents = Array.isArray(attempt.navigation_events) ? attempt.navigation_events.slice(-99) : [];
    if (body.navigationEvent && typeof body.navigationEvent.type === 'string') {
      navigationEvents.push({ type: body.navigationEvent.type.slice(0, 40), at: new Date().toISOString() });
    }
    const { error } = await supabase.from('level3_exam_attempts').update({
      answers, writing_text: writingText, speaking_transcript: speakingTranscript,
      current_section: currentSection, submitted_sections: submittedSections,
      navigation_events: navigationEvents, updated_at: new Date().toISOString(),
    }).eq('id', attemptId).eq('user_id', user.id);
    if (error) return Response.json({ error: 'AUTOSAVE_FAILED' }, { status: 500 });
    return Response.json({ saved: true, submittedSections });
  } catch (error) {
    console.error('Level 3 exam attempt error', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'EXAM_REQUEST_FAILED' }, { status: 500 });
  }
}
