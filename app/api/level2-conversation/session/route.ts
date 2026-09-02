import { randomInt } from 'node:crypto';
import { conversationRoom, facilitatorPrompt } from '../../../../data/level2/conversation-room-private';
import { createOpenAISafetyIdentifier } from '../../../../lib/openai-safety';
import { createServerSupabaseClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

const rateWindows = new Map<string, number[]>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_SESSIONS_PER_WINDOW = 5;

function isRateLimited(userId: string) {
  const now = Date.now();
  const recent = (rateWindows.get(userId) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= MAX_SESSIONS_PER_WINDOW) {
    rateWindows.set(userId, recent);
    return true;
  }
  recent.push(now);
  rateWindows.set(userId, recent);
  return false;
}

export async function POST(request: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      return Response.json({ error: 'VOICE_SERVICE_NOT_CONFIGURED' }, { status: 503 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    if (isRateLimited(user.id)) return Response.json({ error: 'VOICE_RATE_LIMITED' }, { status: 429 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: 'VOICE_SERVICE_NOT_CONFIGURED' }, { status: 503 });

    const sdp = await request.text();
    if (!sdp || sdp.length > 100_000 || !sdp.startsWith('v=')) {
      return Response.json({ error: 'INVALID_SDP' }, { status: 400 });
    }

    const selectedChallenge = conversationRoom.challengeBank[randomInt(conversationRoom.challengeBank.length)];
    const hiddenChallengeInstruction = [
      '',
      '# المشكلة المختارة لهذه المحاولة — سرية حتى المرحلة الرابعة',
      `المشكلة المختارة: ${selectedChallenge.ar}`,
      'لا تذكر هذه المشكلة، ولا تلمّح إليها، ولا تكشف وجودها قبل الوصول إلى مرحلة «المشكلة المفاجئة».',
      'في المرحلة الرابعة اكشف هذه المشكلة وحدها، ثم اطلب حلًا واختبر الحل بسؤال عملي واحد.',
    ].join('\n');

    const session = {
      type: 'realtime',
      model: process.env.OPENAI_REALTIME_MODEL || conversationRoom.technical.defaultModel,
      output_modalities: ['audio'],
      instructions: `${facilitatorPrompt}${hiddenChallengeInstruction}`,
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          transcription: {
            model: process.env.OPENAI_TRANSCRIPTION_MODEL || conversationRoom.technical.inputTranscriptionModel,
            language: 'ar',
          },
          turn_detection: { type: conversationRoom.technical.turnDetection },
        },
        output: {
          format: { type: 'audio/pcm' },
          voice: process.env.OPENAI_REALTIME_VOICE || conversationRoom.technical.defaultVoice,
        },
      },
    };

    const body = new FormData();
    body.set('sdp', sdp);
    body.set('session', JSON.stringify(session));

    const upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Safety-Identifier': createOpenAISafetyIdentifier(user.id),
      },
      body,
    });
    const payload = await upstream.text();

    if (!upstream.ok) {
      console.error('A2 realtime session failed', upstream.status, payload.slice(0, 300));
      const error = upstream.status === 429 ? 'VOICE_LIMIT_REACHED' : 'VOICE_SESSION_FAILED';
      return Response.json({ error }, { status: 502 });
    }

    return new Response(payload, {
      status: 200,
      headers: { 'Content-Type': 'application/sdp', 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'OPENAI_SAFETY_SALT_MISSING') {
      return Response.json({ error: 'VOICE_SERVICE_NOT_CONFIGURED' }, { status: 503 });
    }
    console.error('A2 realtime route error', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'VOICE_SESSION_FAILED' }, { status: 500 });
  }
}
