export function playArabic(text: string, audioUrl?: string, rate = 0.82): boolean {
  if (typeof window === 'undefined') return false;

  if (audioUrl) {
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.playbackRate = rate;
    void audio.play().catch(() => playArabic(text, undefined, rate));
    return true;
  }

  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false;

  const speakNow = () => {
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.rate = rate;
    const voice = synth.getVoices().find(item => item.lang.toLowerCase().startsWith('ar'));
    if (voice) utterance.voice = voice;
    synth.resume();
    synth.speak(utterance);
  };

  if (synth.getVoices().length > 0) speakNow();
  else {
    synth.onvoiceschanged = speakNow;
    window.setTimeout(speakNow, 250);
  }
  return true;
}
