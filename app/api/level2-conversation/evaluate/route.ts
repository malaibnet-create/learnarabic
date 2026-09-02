import { conversationRoom, evaluatorPrompt } from '../../../../data/level2/conversation-room-private';
import { createOpenAISafetyIdentifier } from '../../../../lib/openai-safety';
import { createServerSupabaseClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

type TranscriptEntry = { role: 'learner' | 'facilitator'; text: string };

const vocabularyIds = conversationRoom.targetVocabulary.map((item) => item.id);
const dimensionIds = conversationRoom.rubric.dimensions.map((item) => item.id);

const reportSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['evaluationStatus', 'total', 'mastery', 'dimensions', 'usedVocabulary', 'grammarEvidence', 'strengthsAr', 'nextStepsAr', 'corrections'],
  properties: {
    evaluationStatus: { type: 'string', enum: ['complete', 'incomplete'] },
    total: { type: 'integer', minimum: 0, maximum: 20 },
    mastery: { type: 'boolean' },
    dimensions: {
      type: 'array', minItems: 5, maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'score', 'max', 'evidenceAr'],
        properties: {
          id: { type: 'string', enum: dimensionIds },
          score: { type: 'integer', minimum: 0, maximum: 5 },
          max: { type: 'integer', minimum: 3, maximum: 5 },
          evidenceAr: { type: 'string' },
        },
      },
    },
    usedVocabulary: {
      type: 'array', maxItems: 16,
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'heardForm', 'evidence', 'correct'],
        properties: {
          id: { type: 'string', enum: vocabularyIds },
          heardForm: { type: 'string' },
          evidence: { type: 'string' },
          correct: { type: 'boolean' },
        },
      },
    },
    grammarEvidence: {
      type: 'object', additionalProperties: false,
      required: ['anSubjunctive', 'prepositionMasdar'],
      properties: {
        anSubjunctive: { type: 'array', maxItems: 6, items: { type: 'string' } },
        prepositionMasdar: { type: 'array', maxItems: 6, items: { type: 'string' } },
      },
    },
    strengthsAr: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
    nextStepsAr: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
    corrections: {
      type: 'array', maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['original', 'corrected', 'explanationAr', 'explanationEn'],
        properties: {
          original: { type: 'string' }, corrected: { type: 'string' },
          explanationAr: { type: 'string' }, explanationEn: { type: 'string' },
        },
      },
    },
  },
} as const;

function cleanTranscript(value: unknown): TranscriptEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-100).flatMap((entry) => {
    if (!entry || (entry.role !== 'learner' && entry.role !== 'facilitator') || typeof entry.text !== 'string') return [];
    const text = entry.text.trim().slice(0, 2000);
    return text ? [{ role: entry.role, text } as TranscriptEntry] : [];
  });
}

function outputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  return (payload?.output || [])
    .flatMap((item: any) => item?.content || [])
    .find((item: any) => item?.type === 'output_text')?.text || '';
}

function incompleteReport() {
  return {
    evaluationStatus: 'incomplete' as const,
    total: 0,
    mastery: false,
    dimensions: conversationRoom.rubric.dimensions.map((item) => ({
      id: item.id, score: 0, max: item.max,
      evidenceAr: 'لا يوجد كلام كافٍ لإعداد دليل موثوق.',
    })),
    usedVocabulary: [],
    grammarEvidence: { anSubjunctive: [], prepositionMasdar: [] },
    strengthsAr: ['بدأتَ المحاولة وتعرّفتَ إلى غرفة المحادثة الصوتية.'],
    nextStepsAr: ['أكمل دورتين كلاميتين على الأقل، والأفضل ثمانية أدوار، للحصول على تقرير موثوق.'],
    corrections: [],
    persistence: 'none' as const,
  };
}

export async function POST(request: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      return Response.json({ error: 'EVALUATION_NOT_CONFIGURED' }, { status: 503 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const transcript = cleanTranscript(body.transcript);
    const learnerTurns = transcript.filter((entry) => entry.role === 'learner').length;
    if (learnerTurns < 2) return Response.json(incompleteReport(), { headers: { 'Cache-Control': 'private, no-store' } });
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'EVALUATION_NOT_CONFIGURED' }, { status: 503 });

    const input = {
      rubric: conversationRoom.rubric,
      activationRules: conversationRoom.activationRules,
      targetVocabulary: conversationRoom.targetVocabulary,
      grammarTargets: conversationRoom.grammarTargets,
      transcript,
    };

    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EVALUATION_MODEL || 'gpt-5-mini',
        instructions: evaluatorPrompt,
        input: JSON.stringify(input),
        safety_identifier: createOpenAISafetyIdentifier(user.id),
        text: { format: { type: 'json_schema', name: 'level2_conversation_report', strict: true, schema: reportSchema } },
        max_output_tokens: 2200,
      }),
    });

    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      console.error('A2 conversation evaluation failed', upstream.status, payload?.error?.type || 'unknown');
      const error = upstream.status === 429 ? 'EVALUATION_LIMIT_REACHED' : 'EVALUATION_FAILED';
      return Response.json({ error }, { status: 502 });
    }

    const report = JSON.parse(outputText(payload));
    const expectedMax = new Map(conversationRoom.rubric.dimensions.map((item) => [item.id, item.max]));
    const dimensions = conversationRoom.rubric.dimensions.map((definition) => {
      const candidate = Array.isArray(report.dimensions)
        ? report.dimensions.find((item: any) => item?.id === definition.id)
        : null;
      return {
        id: definition.id,
        max: definition.max,
        score: Math.max(0, Math.min(definition.max, Number(candidate?.score) || 0)),
        evidenceAr: typeof candidate?.evidenceAr === 'string' ? candidate.evidenceAr.slice(0, 700) : 'لم يُذكر دليل واضح.',
      };
    });
    const total = dimensions.reduce((sum, item) => sum + item.score, 0);
    const validVocabulary = Array.isArray(report.usedVocabulary)
      ? report.usedVocabulary.filter((item: any) => vocabularyIds.includes(item?.id)).slice(0, 16)
      : [];
    const correctVocabularyCount = new Set(validVocabulary.filter((item: any) => item.correct).map((item: any) => item.id)).size;
    const evaluationStatus = report.evaluationStatus === 'complete' ? 'complete' : 'incomplete';
    const mastery = evaluationStatus === 'complete' && total >= conversationRoom.rubric.mastery;
    const consentToStoreResults = body.consentToStoreResults === true;
    let bestScore: number | undefined;
    let persistence: 'database' | 'local' | 'none' = 'none';

    if (consentToStoreResults) {
      const { data: bestRows } = await supabase
        .from('conversation_room_attempts')
        .select('score')
        .eq('lesson_id', conversationRoom.lessonId)
        .order('score', { ascending: false })
        .limit(1);
      bestScore = Math.max(Number(bestRows?.[0]?.score || 0), total);
      const { error: saveError } = await supabase.from('conversation_room_attempts').insert({
        user_id: user.id,
        lesson_id: conversationRoom.lessonId,
        started_at: typeof body.startedAt === 'string' ? body.startedAt : null,
        ended_at: new Date().toISOString(),
        duration_seconds: Math.max(0, Math.min(600, Number(body.durationSeconds) || 0)),
        completed: evaluationStatus === 'complete',
        score: total,
        best_score: bestScore,
        dimensions,
        used_expressions: validVocabulary,
        help_count: Math.max(0, Math.min(7, Number(body.helpCount) || 0)),
        transcript,
      });
      persistence = saveError ? 'local' : 'database';
      if (saveError) console.warn('A2 conversation attempt was not persisted; apply migration 009.', saveError.code);
    }

    return Response.json({
      evaluationStatus,
      total,
      mastery,
      dimensions,
      usedVocabulary: validVocabulary,
      vocabularyTargetMet: correctVocabularyCount >= conversationRoom.activationRules.minimumUniqueVocabularyFamilies,
      grammarEvidence: report.grammarEvidence || { anSubjunctive: [], prepositionMasdar: [] },
      strengthsAr: Array.isArray(report.strengthsAr) ? report.strengthsAr.slice(0, 3) : [],
      nextStepsAr: Array.isArray(report.nextStepsAr) ? report.nextStepsAr.slice(0, 3) : [],
      corrections: Array.isArray(report.corrections) ? report.corrections.slice(0, 3) : [],
      bestScore,
      persistence,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'OPENAI_SAFETY_SALT_MISSING') {
      return Response.json({ error: 'EVALUATION_NOT_CONFIGURED' }, { status: 503 });
    }
    console.error('A2 evaluation route error', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'EVALUATION_FAILED' }, { status: 500 });
  }
}
