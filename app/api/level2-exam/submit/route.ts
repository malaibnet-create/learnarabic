import { createServerSupabaseClient } from '../../../../lib/supabase/server';
import { createOpenAISafetyIdentifier } from '../../../../lib/openai-safety';
import { countExamWords, determineExamStatus, finalExamPrivate, scoreObjectiveAnswers } from '../../../../lib/level2-exam-server';
import { productionEvaluatorPrompt } from '../../../../data/level2/final-exam-prompts';

export const runtime = 'nodejs';

type TranscriptEntry = { role: 'learner' | 'examiner'; text: string };

const correctionSchema = {
  type: 'array', maxItems: 3,
  items: { type: 'object', additionalProperties: false, required: ['original', 'corrected', 'explanationAr', 'explanationEn'], properties: {
    original: { type: 'string' }, corrected: { type: 'string' }, explanationAr: { type: 'string' }, explanationEn: { type: 'string' },
  } },
} as const;

function schemaFor(kind: 'writing' | 'speaking') {
  const dimensions = kind === 'writing'
    ? { task: 3, vocabulary: 2, grammar: 2, organization: 2, mechanics: 1 }
    : { task: 3, vocabulary: 2, grammar: 2, interaction: 2, intelligibility: 1 };
  return {
    type: 'object', additionalProperties: false,
    required: ['evaluationStatus', 'dimensions', 'strengths', 'nextSteps', 'corrections', 'summaryAr', 'summaryEn'],
    properties: {
      evaluationStatus: { type: 'string', enum: ['complete', 'incomplete'] },
      dimensions: { type: 'object', additionalProperties: false, required: Object.keys(dimensions), properties: Object.fromEntries(Object.entries(dimensions).map(([id, max]) => [id, { type: 'integer', minimum: 0, maximum: max }])) },
      strengths: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } },
      nextSteps: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } },
      corrections: correctionSchema,
      summaryAr: { type: 'string' }, summaryEn: { type: 'string' },
    },
  } as const;
}

function outputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  return (payload?.output || []).flatMap((item: any) => item?.content || []).find((item: any) => item?.type === 'output_text')?.text || '';
}

function cleanAnswers(value: unknown) {
  if (!value || typeof value !== 'object') return {} as Record<string, string>;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([id, answer]) => typeof answer === 'string' ? [[id, answer.slice(0, 500)]] : []));
}

function cleanTranscript(value: unknown): TranscriptEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-80).flatMap((entry) => {
    if (!entry || (entry.role !== 'learner' && entry.role !== 'examiner') || typeof entry.text !== 'string') return [];
    const text = entry.text.trim().slice(0, 3000);
    return text ? [{ role: entry.role, text } as TranscriptEntry] : [];
  });
}

async function evaluateProduction(kind: 'writing' | 'speaking', content: string, userId: string) {
  const rubric = kind === 'writing' ? finalExamPrivate.writing.rubric : finalExamPrivate.speaking.rubric;
  const taskDefinition = kind === 'writing' ? finalExamPrivate.writing : finalExamPrivate.speaking;
  const prompt = `${productionEvaluatorPrompt}\n\nالقسم: ${kind}\nتعريف المهمة: ${JSON.stringify(taskDefinition)}\nسلم التقييم: ${JSON.stringify(rubric)}\n\nإجابة الطالب:\n${content}`;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_EVALUATION_MODEL || 'gpt-5-mini', instructions: 'قيّم فقط وفق السلم. أعد JSON صالحًا مطابقًا للمخطط.',
      input: prompt, safety_identifier: createOpenAISafetyIdentifier(userId), store: false,
      text: { format: { type: 'json_schema', name: `${kind}_exam_evaluation`, strict: true, schema: schemaFor(kind) } }, max_output_tokens: 1600,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 429 ? 'EVALUATION_LIMIT_REACHED' : `EVALUATION_FAILED_${kind.toUpperCase()}`);
  const evaluation = JSON.parse(outputText(payload));
  const score = evaluation.evaluationStatus === 'complete'
    ? Object.values(evaluation.dimensions as Record<string, number>).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
    : 0;
  return { ...evaluation, score: Math.min(10, score), corrections: (evaluation.corrections || []).slice(0, 3) };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> | null = null;
    let userId = 'local-preview';
    let attempt: any = null;
    if (configured) {
      supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
      userId = user.id;
      const { data } = await supabase.from('level2_exam_attempts').select('*').eq('id', body.attemptId).eq('user_id', user.id).maybeSingle();
      attempt = data;
      if (!attempt) return Response.json({ error: 'ATTEMPT_NOT_FOUND' }, { status: 404 });
      if (new Date(attempt.expires_at).getTime() <= Date.now()) return Response.json({ error: 'ATTEMPT_EXPIRED' }, { status: 409 });
    }
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_SAFETY_SALT) return Response.json({ error: 'EVALUATION_NOT_CONFIGURED' }, { status: 503 });

    const answers = { ...(attempt?.answers || {}), ...cleanAnswers(body.answers) };
    const writingText = typeof body.writingText === 'string' ? body.writingText.slice(0, 20_000) : String(attempt?.writing_text || '');
    const speakingTranscript = cleanTranscript(body.speakingTranscript || attempt?.speaking_transcript);
    const objective = scoreObjectiveAnswers(answers);
    if (objective.feedback.some((item) => !item.selectedAnswer)) return Response.json({ error: 'OBJECTIVE_SECTIONS_INCOMPLETE' }, { status: 409 });
    if (!writingText.trim() || speakingTranscript.filter((entry) => entry.role === 'learner').length < 6) return Response.json({ error: 'PRODUCTION_SECTIONS_INCOMPLETE' }, { status: 409 });
    if (attempt) {
      const submitted = Array.isArray(attempt.submitted_sections) ? attempt.submitted_sections : [];
      if (!['vocabulary', 'reading', 'listening', 'grammar', 'writing', 'speaking'].every((section) => submitted.includes(section))) {
        return Response.json({ error: 'SECTIONS_NOT_SUBMITTED' }, { status: 409 });
      }
      if (Number(attempt.listening_plays) < 1) return Response.json({ error: 'LISTENING_REQUIRED' }, { status: 409 });
    }

    const previousWriting = attempt?.writing_evaluation;
    const previousSpeaking = attempt?.speaking_evaluation;
    let writingEvaluation: any;
    let speakingEvaluation: any;
    try {
      writingEvaluation = attempt?.status === 'production_retake' && Number(previousWriting?.score) >= 5 ? previousWriting : await evaluateProduction('writing', writingText, userId);
      speakingEvaluation = attempt?.status === 'production_retake' && Number(previousSpeaking?.score) >= 5 ? previousSpeaking : await evaluateProduction('speaking', speakingTranscript.map((entry) => `${entry.role === 'learner' ? 'الطالب' : 'الممتحن'}: ${entry.text}`).join('\n'), userId);
    } catch (error) {
      if (supabase && attempt) await supabase.from('level2_exam_attempts').update({ status: 'evaluation_pending', answers, writing_text: writingText, speaking_transcript: speakingTranscript, updated_at: new Date().toISOString() }).eq('id', attempt.id).eq('user_id', userId);
      return Response.json({ error: error instanceof Error ? error.message : 'EVALUATION_FAILED', retryable: true }, { status: 502 });
    }

    const sectionScores = { ...objective.sectionScores, writing: writingEvaluation.score, speaking: speakingEvaluation.score };
    const totalScore = Object.values(sectionScores).reduce((sum, value) => sum + Number(value || 0), 0);
    const resultStatus = determineExamStatus(totalScore, writingEvaluation.score, speakingEvaluation.score);
    const previousBest = Number(attempt?.best_score || 0);
    const bestScore = Math.max(previousBest, totalScore);
    const suggestedReview = Object.entries(sectionScores).flatMap(([section, score]) => {
      const max = Number(finalExamPrivate.exam.sections.find((item) => item.id === section)?.score || 1);
      return Number(score) / max < 0.6 ? [section] : [];
    });

    if (supabase && attempt) {
      const { error } = await supabase.from('level2_exam_attempts').update({
        status: resultStatus, ended_at: new Date().toISOString(), answers,
        writing_text: writingText, speaking_transcript: speakingTranscript,
        section_scores: sectionScores, objective_feedback: objective.feedback,
        writing_evaluation: writingEvaluation, speaking_evaluation: speakingEvaluation,
        total_score: totalScore, best_score: bestScore, updated_at: new Date().toISOString(),
      }).eq('id', attempt.id).eq('user_id', userId);
      if (error) return Response.json({ error: 'RESULT_SAVE_FAILED', retryable: true }, { status: 500 });
    }

    return Response.json({
      resultStatus, totalScore, bestScore, passScore: 80, sectionScores,
      objectiveFeedback: objective.feedback, writingEvaluation, speakingEvaluation,
      suggestedReview, attemptNumber: Number(attempt?.attempt_number || body.attemptNumber || 1),
      listeningTranscript: finalExamPrivate.listening.scriptAr,
    });
  } catch (error) {
    console.error('Level 2 exam submit error', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'EXAM_SUBMIT_FAILED', retryable: true }, { status: 500 });
  }
}
