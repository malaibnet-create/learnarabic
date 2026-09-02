export function readRealtimeEvent(event) {
  if (!event || typeof event.type !== 'string') return {};
  if (event.type === 'input_audio_buffer.speech_started') return { status: 'learner-speaking' };
  if (event.type === 'input_audio_buffer.speech_stopped') return { status: 'understanding' };
  if (event.type === 'response.created' || event.type === 'response.output_audio.delta' || event.type === 'response.audio.delta') {
    return { status: 'facilitator-speaking' };
  }
  if (event.type === 'response.done') return { status: 'learner-turn' };
  if (event.type === 'conversation.item.input_audio_transcription.completed') {
    return { transcript: { role: 'learner', text: String(event.transcript || '').trim() } };
  }
  if (event.type === 'response.output_audio_transcript.done' || event.type === 'response.audio_transcript.done') {
    return { transcript: { role: 'facilitator', text: String(event.transcript || '').trim() } };
  }
  if (event.type === 'error') return { status: 'error', error: event.error?.message || 'تعذر إكمال المحادثة الصوتية.' };
  return {};
}

export function formatConversationTime(totalSeconds) {
  const safe = Math.max(0, Number.isFinite(totalSeconds) ? Math.floor(totalSeconds) : 0);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
