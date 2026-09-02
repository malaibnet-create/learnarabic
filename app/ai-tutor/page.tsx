'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatConversationTime, readRealtimeEvent } from '../../lib/conversation-realtime.mjs';

type TutorContext = { name: string; level: string; track: string; goal: string; interests: string[]; recentLessons: string[]; completedCount: number };
type TranscriptEntry = { role: 'learner' | 'facilitator'; text: string };
type Status = 'idle' | 'connecting' | 'facilitator-speaking' | 'learner-turn' | 'learner-speaking' | 'understanding' | 'paused' | 'ended' | 'error';

const scenarios = ['محادثة عامة', 'التعارف والدراسة', 'العمل والتطور الشخصي', 'في الجامعة', 'السفر', 'التسوق', 'إبداء الرأي'];
const statusText: Record<Status, { ar: string; en: string }> = {
  idle: { ar: 'جاهز للبدء', en: 'Ready' }, connecting: { ar: 'جاري الاتصال', en: 'Connecting' },
  'facilitator-speaking': { ar: 'الأستاذ يتحدث', en: 'Tutor is speaking' }, 'learner-turn': { ar: 'دورك الآن', en: 'Your turn' },
  'learner-speaking': { ar: 'أنت تتحدث', en: 'You are speaking' }, understanding: { ar: 'يفهم إجابتك', en: 'Understanding' },
  paused: { ar: 'متوقف مؤقتًا', en: 'Paused' }, ended: { ar: 'انتهت الجلسة', en: 'Ended' }, error: { ar: 'تعذر الاتصال', en: 'Connection error' },
};

function errorMessage(code: string) {
  const messages: Record<string, string> = {
    AUTH_REQUIRED: 'يجب تسجيل الدخول أولًا. · Please sign in first.',
    VOICE_SERVICE_NOT_CONFIGURED: 'خدمة الصوت غير مهيأة. أضف OPENAI_API_KEY في الخادم. · Voice service is not configured.',
    VOICE_RATE_LIMITED: 'بدأت جلسات كثيرة خلال وقت قصير. انتظر قليلًا. · Too many sessions; please wait.',
    VOICE_LIMIT_REACHED: 'تم بلوغ حد OpenAI أو لا يوجد رصيد كافٍ. · OpenAI limit or credit reached.',
    VOICE_SESSION_FAILED: 'تعذر إنشاء الجلسة الصوتية. تحقق من إعدادات OpenAI والاتصال. · Could not start the voice session.',
  };
  return messages[code] || 'حدث خطأ غير متوقع. حاول مرة أخرى. · Something went wrong. Please try again.';
}

export default function AiTutorPage() {
  const router = useRouter();
  const [context, setContext] = useState<TutorContext | null>(null);
  const [scenario, setScenario] = useState(scenarios[0]);
  const [status, setStatus] = useState<Status>('idle');
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  useEffect(() => {
    fetch('/api/ai-tutor', { cache: 'no-store' }).then(async (response) => {
      if (response.status === 401) return router.replace('/login');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'LOAD_FAILED');
      setContext(data);
    }).catch(() => setError('تعذر تحميل سياق رحلتك التعليمية. · Could not load your learning context.'));
    return () => cleanup();
  }, [router]);

  const lastMessage = transcript.at(-1)?.text || '';
  const learnerTurns = useMemo(() => transcript.filter((entry) => entry.role === 'learner').length, [transcript]);

  function addTranscript(entry?: TranscriptEntry) {
    if (!entry?.text) return;
    const last = transcriptRef.current.at(-1);
    if (last?.role === entry.role && last.text === entry.text) return;
    transcriptRef.current = [...transcriptRef.current, entry];
    setTranscript(transcriptRef.current);
  }

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    channelRef.current?.close();
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; }
    channelRef.current = null; peerRef.current = null; streamRef.current = null;
    setConnected(false);
  }

  function sendEvent(event: Record<string, unknown>) {
    if (channelRef.current?.readyState !== 'open') return false;
    channelRef.current.send(JSON.stringify(event));
    return true;
  }

  function requestResponse(instructions: string) {
    sendEvent({ type: 'response.create', response: { output_modalities: ['audio'], instructions } });
  }

  async function startConversation(withMicrophone: boolean) {
    if (!context) return;
    cleanup();
    setError(''); setStatus('connecting'); setTextMode(!withMicrophone); setElapsed(0);
    transcriptRef.current = []; setTranscript([]); setMuted(false); setPaused(false);
    try {
      const stream = withMicrophone
        ? await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        : new MediaStream();
      streamRef.current = stream;
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => setError('اضغط مرة على الصفحة للسماح بتشغيل الصوت. · Tap once to allow audio.'));
      };

      const channel = peer.createDataChannel('oai-events');
      channelRef.current = channel;
      channel.onmessage = ({ data }) => {
        try {
          const change = readRealtimeEvent(JSON.parse(data));
          if (change.status) setStatus(change.status as Status);
          if (change.transcript) addTranscript(change.transcript as TranscriptEntry);
          if (change.error) setError(change.error);
        } catch { /* Ignore non-critical malformed events. */ }
      };
      channel.onopen = () => {
        setConnected(true); setStatus('facilitator-speaking');
        timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
        requestResponse(`ابدأ الآن أنت المحادثة. حيّ ${context.name} باسمه، واذكر أنك تعرف أن مستواه ${context.level}، ثم اسأله سؤالًا واحدًا مناسبًا في سيناريو ${scenario}.`);
      };
      channel.onclose = () => { setConnected(false); setStatus('ended'); };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
          setConnected(false); setStatus('error'); setError('انقطع الاتصال. تحقق من الشبكة ثم أعد المحاولة. · Connection lost.');
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch('/api/ai-tutor/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp', 'X-Tutor-Scenario': scenario },
        body: offer.sdp || '',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'VOICE_SESSION_FAILED' }));
        throw new Error(payload.error || 'VOICE_SESSION_FAILED');
      }
      await peer.setRemoteDescription({ type: 'answer', sdp: await response.text() });
    } catch (caught) {
      cleanup(); setStatus('error'); setTextMode(true);
      const code = caught instanceof DOMException && caught.name === 'NotAllowedError' ? 'MIC_DENIED' : caught instanceof Error ? caught.message : '';
      setError(code === 'MIC_DENIED' ? 'لم تسمح باستعمال الميكروفون. اسمح به أو ابدأ بالكتابة. · Microphone permission was denied.' : errorMessage(code));
    }
  }

  function submitText(event: FormEvent) {
    event.preventDefault();
    const text = textInput.trim();
    if (!text || !connected) return;
    addTranscript({ role: 'learner', text });
    sendEvent({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
    requestResponse('أجب عن رسالة الطالب صوتيًا، صحح خطأ واحدًا فقط عند الحاجة، ثم اطرح سؤالًا واحدًا مناسبًا لمستواه ودروسه السابقة.');
    setTextInput(''); setStatus('understanding');
  }

  function toggleMute() {
    const next = !muted; setMuted(next);
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next && !paused; });
  }

  function togglePause() {
    const next = !paused; setPaused(next); setStatus(next ? 'paused' : 'learner-turn');
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next && !muted; });
  }

  function endConversation() {
    setStatus('ended'); cleanup();
  }

  return <main className="tutor-page tutor-realtime-page">
    <header className="tutor-topbar"><a className="brand" href="/dashboard"><span className="brand-mark">ع</span><span>Dar<span>Lugha</span></span></a><a href="/dashboard">لوحة الطالب · Dashboard</a></header>
    <section className="tutor-voice-hero">
      <div><div className="eyebrow">AI TUTOR · أستاذ يعرف رحلتك</div><h1>محادثة عربية مباشرة بالصوت</h1><p>يبدأ الأستاذ بالتحية والسؤال، ثم يستمع إليك ويكيّف اللغة مع مستواك والدروس التي أكملتها.</p><p dir="ltr">The tutor starts the conversation, listens, and adapts to your level and completed lessons.</p></div>
      <div className="tutor-profile"><strong>{context?.name || 'جارٍ التحميل…'}</strong><span>{context ? `${context.level} · ${context.track}` : '...'}</span><small>{context ? `${context.completedCount} أقسام مكتملة` : ''}</small></div>
    </section>

    <section className="tutor-voice-layout">
      <aside className="tutor-context-panel">
        <label>موضوع المحادثة · Topic<select value={scenario} onChange={(event) => setScenario(event.target.value)} disabled={connected}>{scenarios.map((item) => <option key={item}>{item}</option>)}</select></label>
        {context && <div className="context-card"><strong>سياقك التعليمي · Your context</strong><p><b>المستوى:</b> {context.level}</p><p><b>الهدف:</b> {context.goal}</p><p><b>المكتمل:</b> {context.completedCount} أقسام</p>{context.recentLessons.length > 0 && <><b>آخر التقدم:</b><ul>{context.recentLessons.slice(0, 4).map((lesson) => <li key={lesson}>{lesson}</li>)}</ul></>}</div>}
        {!connected && <div className="tutor-start-actions"><button type="button" className="button" disabled={!context} onClick={() => void startConversation(true)}>🎙️ ابدأ محادثة صوتية<br /><small>Start voice conversation</small></button><button type="button" className="tutor-secondary" disabled={!context} onClick={() => void startConversation(false)}>⌨️ ابدأ بالكتابة<br /><small>Start with typing</small></button></div>}
      </aside>

      <section className="tutor-live-panel">
        <header><div className={`tutor-live-status ${status}`}><span /> <strong>{statusText[status].ar}</strong><small dir="ltr">{statusText[status].en}</small></div><time>{formatConversationTime(elapsed)}</time></header>
        <div className={`tutor-orb ${status === 'facilitator-speaking' || status === 'learner-speaking' ? 'active' : ''}`} aria-hidden="true"><span /></div>
        <h2>{status === 'learner-turn' || status === 'learner-speaking' ? 'تحدث الآن، أو اكتب إجابتك' : statusText[status].ar}</h2>
        <p dir="ltr">{status === 'learner-turn' || status === 'learner-speaking' ? 'Speak now, or type your answer.' : statusText[status].en}</p>
        {captions && <div className="tutor-caption" aria-live="polite">{lastMessage || 'سيظهر نص الحديث هنا بعد اكتمال كل دور. · Captions will appear here.'}</div>}
        {textMode && <form className="tutor-text-form" onSubmit={submitText}><input value={textInput} onChange={(event) => setTextInput(event.target.value)} placeholder="اكتب إجابتك بالعربية…" aria-label="إجابتك المكتوبة" /><button type="submit" disabled={!connected || !textInput.trim()}>إرسال · Send</button></form>}
        {error && <div className="tutor-error" role="alert">{error}</div>}
        <div className="tutor-session-summary"><span><b>{learnerTurns}</b> أدوارك · Your turns</span><span><b>{context?.level || '—'}</b> المستوى · Level</span></div>
        <footer className="tutor-live-controls">
          <button type="button" onClick={toggleMute} disabled={!streamRef.current?.getAudioTracks().length}>{muted ? '🎙️ إلغاء الكتم · Unmute' : '🔇 كتم · Mute'}</button>
          <button type="button" onClick={togglePause} disabled={!connected}>{paused ? '▶ متابعة · Resume' : '⏸ توقف · Pause'}</button>
          <button type="button" onClick={() => setCaptions((value) => !value)}>{captions ? 'إخفاء النص · Hide captions' : 'إظهار النص · Show captions'}</button>
          <button type="button" onClick={() => setTextMode((value) => !value)}>⌨️ الكتابة · Type</button>
          <button type="button" className="danger" onClick={endConversation} disabled={!connected}>إنهاء · End</button>
        </footer>
      </section>
    </section>
  </main>;
}

