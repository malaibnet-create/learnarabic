import { createServerSupabaseClient } from '../../../../lib/supabase/server';
import { createOpenAISafetyIdentifier } from '../../../../lib/openai-safety';
import { conversationRoom, evaluatorPrompt } from '../../../../data/level3/conversation-room';

export const runtime = 'nodejs';

type TranscriptEntry = { role: 'learner' | 'facilitator'; text: string };

const evaluationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['evaluationStatus', 'totalScore', 'passed', 'dimensions', 'usedExpressions', 'strengths', 'nextSteps', 'corrections', 'summaryAr', 'summaryEn'],
  properties: {
    evaluationStatus: { type: 'string', enum: ['complete', 'incomplete'] },
    totalScore: { type: 'integer', minimum: 0, maximum: 20 },
    passed: { type: 'boolean' },
    dimensions: {
      type: 'object', additionalProperties: false,
      required: ['task', 'coherence', 'expressions', 'grammar', 'vocabulary', 'fluency'],
      properties: {
        task: { type: 'integer', minimum: 0, maximum: 5 },
        coherence: { type: 'integer', minimum: 0, maximum: 4 },
        expressions: { type: 'integer', minimum: 0, maximum: 4 },
        grammar: { type: 'integer', minimum: 0, maximum: 3 },
        vocabulary: { type: 'integer', minimum: 0, maximum: 2 },
        fluency: { type: 'integer', minimum: 0, maximum: 2 },
      },
    },
    usedExpressions: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    strengths: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
    nextSteps: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
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
    summaryAr: { type: 'string' },
    summaryEn: { type: 'string' },
  },
} as const;

function cleanTranscript(value: unknown): TranscriptEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-80).flatMap((entry) => {
    if (!entry || (entry.role !== 'learner' && entry.role !== 'facilitator') || typeof entry.text !== 'string') return [];
    const text = entry.text.trim().slice(0, 3000);
    return text ? [{ role: entry.role, text } as TranscriptEntry] : [];
  });
}

function outputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  return (payload?.output || []).flatMap((item: any) => item?.content || []).find((item: any) => item?.type === 'output_text')?.text || '';
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
    if (learnerTurns < 2) {
      return Response.json({
        evaluationStatus: 'incomplete', totalScore: 0, passed: false,
        dimensions: { task: 0, coherence: 0, expressions: 0, grammar: 0, vocabulary: 0, fluency: 0 },
        usedExpressions: [], strengths: ['بدأتَ المحاولة الصوتية.'],
        nextSteps: ['أكمل دورتين كلاميتين على الأقل حتى يمكن إعداد تقرير موثوق.'], corrections: [],
        summaryAr: 'المحادثة قصيرة أو أن التفريغ الصوتي غير مكتمل، لذلك لم تُحتسب درجة.',
        summaryEn: 'The conversation or transcript is too short for a reliable score.',
      }, { status: 200 });
    }
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'EVALUATION_NOT_CONFIGURED' }, { status: 503 });

    const prompt = `${evaluatorPrompt}\n\nسلم التقييم:\n${JSON.stringify(conversationRoom.rubric)}\n\nالعبارات المستهدفة:\n${conversationRoom.targetExpressions.map((item) => item.ar).join('، ')}\n\nنص المحادثة:\n${transcript.map((entry) => `${entry.role === 'learner' ? 'الطالب' : 'المحاور'}: ${entry.text}`).join('\n')}`;
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_EVALUATION_MODEL || 'gpt-4o-mini',
        instructions: 'أعد JSON صالحًا فقط. لا تخترع أدلة غير موجودة في النص.',
        input: prompt,
        safety_identifier: createOpenAISafetyIdentifier(user.id),
        text: { format: { type: 'json_schema', name: 'conversation_evaluation', strict: true, schema: evaluationSchema } },
        max_output_tokens: 1800,
      }),
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      console.error('Conversation evaluation failed', upstream.status, payload?.error?.type || 'unknown');
      return Response.json({ error: upstream.status === 429 ? 'EVALUATION_LIMIT_REACHED' : 'EVALUATION_FAILED' }, { status: 502 });
    }
    const evaluation = JSON.parse(outputText(payload));
    evaluation.totalScore = Math.max(0, Math.min(20, Number(evaluation.totalScore) || 0));
    evaluation.passed = evaluation.evaluationStatus === 'complete' && evaluation.totalScore >= conversationRoom.rubric.mastery;

    const consentToStoreTranscript = body.consentToStoreTranscript === true;
    const { data: bestRows } = await supabase.from('conversation_room_attempts').select('score').eq('lesson_id', conversationRoom.lessonId).order('score', { ascending: false }).limit(1);
    const previousBest = Number(bestRows?.[0]?.score || 0);
    const bestScore = Math.max(previousBest, evaluation.totalScore);
    const { error: saveError } = await supabase.from('conversation_room_attempts').insert({
      user_id: user.id,
      lesson_id: conversationRoom.lessonId,
      started_at: typeof body.startedAt === 'string' ? body.startedAt : null,
      ended_at: new Date().toISOString(),
      duration_seconds: Math.max(0, Math.min(900, Number(body.durationSeconds) || 0)),
      completed: evaluation.evaluationStatus === 'complete',
      score: evaluation.totalScore,
      best_score: bestScore,
      dimensions: evaluation.dimensions,
      used_expressions: evaluation.usedExpressions,
      help_count: Math.max(0, Math.min(99, Number(body.helpCount) || 0)),
      transcript: consentToStoreTranscript ? transcript : null,
    });
    if (saveError) console.warn('Conversation attempt was not persisted; apply migration 009.', saveError.code);

    return Response.json({ ...evaluation, bestScore, persistence: saveError ? 'local' : 'database' });
  } catch (error) {
    console.error('Evaluation route error', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'EVALUATION_FAILED' }, { status: 500 });
  }
}
