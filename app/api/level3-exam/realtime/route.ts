import { createServerSupabaseClient } from '../../../../lib/supabase/server';
import { createOpenAISafetyIdentifier } from '../../../../lib/openai-safety';
import { speakingExaminerPrompt } from '../../../../data/level3/final-exam-prompts';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !process.env.OPENAI_API_KEY) {
      return Response.json({ error: 'VOICE_SERVICE_NOT_CONFIGURED' }, { status: 503 });
    }
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    const attemptId = new URL(request.url).searchParams.get('attemptId');
    if (!attemptId) return Response.json({ error: 'ATTEMPT_REQUIRED' }, { status: 400 });
    const { data: attempt } = await supabase.from('level3_exam_attempts').select('id,status,expires_at,submitted_sections').eq('id', attemptId).eq('user_id', user.id).maybeSingle();
    if (!attempt) return Response.json({ error: 'ATTEMPT_NOT_FOUND' }, { status: 404 });
    if (new Date(attempt.expires_at).getTime() <= Date.now()) return Response.json({ error: 'ATTEMPT_EXPIRED' }, { status: 409 });
    if ((attempt.submitted_sections || []).includes('speaking')) return Response.json({ error: 'SECTION_ALREADY_SUBMITTED' }, { status: 409 });

    const sdp = await request.text();
    if (!sdp || sdp.length > 100_000 || !sdp.startsWith('v=')) return Response.json({ error: 'INVALID_SDP' }, { status: 400 });
    const session = {
      type: 'realtime',
      model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1',
      output_modalities: ['audio'],
      instructions: speakingExaminerPrompt,
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          transcription: { model: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-live-transcribe' },
          turn_detection: { type: 'semantic_vad' },
        },
        output: { format: { type: 'audio/pcm' }, voice: process.env.OPENAI_REALTIME_VOICE || 'marin' },
      },
    };
    const form = new FormData(); form.set('sdp', sdp); form.set('session', JSON.stringify(session));
    const upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'OpenAI-Safety-Identifier': createOpenAISafetyIdentifier(user.id) }, body: form,
    });
    const payload = await upstream.text();
    if (!upstream.ok) {
      console.error('Exam realtime session failed', upstream.status, payload.slice(0, 250));
      return Response.json({ error: upstream.status === 429 ? 'VOICE_LIMIT_REACHED' : 'VOICE_SESSION_FAILED' }, { status: 502 });
    }
    return new Response(payload, { status: 200, headers: { 'Content-Type': 'application/sdp', 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Exam realtime route error', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'VOICE_SESSION_FAILED' }, { status: 500 });
  }
}
