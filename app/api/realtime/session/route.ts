import { createServerSupabaseClient } from '../../../../lib/supabase/server';
import { createOpenAISafetyIdentifier } from '../../../../lib/openai-safety';
import { conversationRoom, facilitatorPrompt } from '../../../../data/level3/conversation-room';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      return Response.json({ error: 'VOICE_SERVICE_NOT_CONFIGURED' }, { status: 503 });
    }
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: 'VOICE_SERVICE_NOT_CONFIGURED' }, { status: 503 });

    const sdp = await request.text();
    if (!sdp || sdp.length > 100_000 || !sdp.startsWith('v=')) {
      return Response.json({ error: 'INVALID_SDP' }, { status: 400 });
    }

    const session = {
      type: 'realtime',
      model: process.env.OPENAI_REALTIME_MODEL || conversationRoom.technical.defaultModel,
      output_modalities: ['audio'],
      instructions: facilitatorPrompt,
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          transcription: { model: process.env.OPENAI_TRANSCRIPTION_MODEL || conversationRoom.technical.inputTranscriptionModel },
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
      console.error('Realtime session failed', upstream.status, payload.slice(0, 300));
      return Response.json({ error: upstream.status === 429 ? 'VOICE_LIMIT_REACHED' : 'VOICE_SESSION_FAILED' }, { status: 502 });
    }
    return new Response(payload, { status: 200, headers: { 'Content-Type': 'application/sdp', 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'OPENAI_SAFETY_SALT_MISSING') {
      return Response.json({ error: 'VOICE_SERVICE_NOT_CONFIGURED' }, { status: 503 });
    }
    console.error('Realtime route error', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'VOICE_SESSION_FAILED' }, { status: 500 });
  }
}
