'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { placementQuestions } from '../../data/placement/public-questions';
import { PlacementResponse } from '../../data/placement/types';

const storageKey = 'darlugha-placement-draft-v2';

export default function PlacementTest() {
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, PlacementResponse>>({});
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const question = placementQuestions[index];
  const response = responses[question.id];
  const wordCount = typeof response?.value === 'string' ? response.value.trim().split(/\s+/).filter(Boolean).length : 0;
  const answered = response?.value !== undefined || Boolean(response?.recordingPath && response.recordingPath !== 'pending-upload');
  const percent = Math.round(((index + 1) / placementQuestions.length) * 100);
  const skillLabel = useMemo(() => ({listening:'Listening',reading:'Reading',writing:'Writing',speaking:'Speaking'}[question.skill]), [question.skill]);

  useEffect(() => { const draft = sessionStorage.getItem(storageKey); if (draft) { try { const saved = JSON.parse(draft); setIndex(saved.index ?? 0); setResponses(saved.responses ?? {}); } catch {} } }, []);
  useEffect(() => { sessionStorage.setItem(storageKey, JSON.stringify({ index, responses })); }, [index, responses]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); recorder.current?.stop(); }, []);

  function update(value: number | string) { setResponses((current) => ({ ...current, [question.id]: { questionId: question.id, value } })); setError(''); }

  async function startRecording() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError('Your browser does not support microphone recording.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream); recorder.current = mediaRecorder; chunks.current = []; setRecording(true); setUploading(false); setRecordingSeconds(0);
      timer.current = setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop()); setRecording(false); if (timer.current) clearInterval(timer.current);
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        try {
          setUploading(true); const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Please sign in again before recording.');
          const path = `${user.id}/speaking-${question.id}-${Date.now()}.webm`;
          const { error: uploadError } = await supabase.storage.from('placement-recordings').upload(path, blob, { contentType: blob.type, upsert: false });
          if (uploadError) throw uploadError;
          setResponses((current) => ({ ...current, [question.id]: { questionId: question.id, recordingPath: path } })); setError('');
        } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Recording upload failed. Check the placement-recordings bucket and its policy.'); }
        finally { setUploading(false); }
      };
      mediaRecorder.start();
    } catch { setError('Microphone permission was denied or is unavailable. You can try again without refreshing the page.'); }
  }

  function stopRecording() { recorder.current?.stop(); }

  async function submit() {
    setSubmitting(true); setError('');
    try { const result = await fetch('/api/placement/submit', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ responses: Object.values(responses) }) }); const payload = await result.json(); if (!result.ok) throw new Error(payload.error || 'Unable to submit the assessment.'); sessionStorage.removeItem(storageKey); window.location.href = `/placement-test/result?attempt=${payload.attemptId}`; } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : 'Unable to submit the assessment.'); setSubmitting(false); }
  }

  const audioFile = question.audioPath?.split('/').pop();
  const audioUrl = audioFile && process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/placement-audio/${audioFile}` : undefined;
  return <main className="shell placement-shell"><header className="topbar"><strong>Arabic Placement Assessment</strong><a className="link" href="/dashboard">Dashboard</a></header><section className="placement-card"><div className="placement-meta"><span>Question {index + 1} of {placementQuestions.length}</span><span>{skillLabel} · {question.cefrLevel}</span></div><div className="progress-track"><span style={{width:`${percent}%`}} /></div>{question.passage && <div className="reading-passage" dir="rtl">{question.passage}</div>}<div className="eyebrow">{question.skill === 'listening' ? 'استماع باللغة العربية الفصحى' : question.skill === 'reading' ? 'قراءة باللغة العربية الفصحى' : question.skill === 'writing' ? 'كتابة' : 'تحدث'}</div><h1 dir="rtl">{question.prompt}</h1>{audioUrl && <div className="audio-box"><audio controls preload="none" src={audioUrl}><track kind="captions" /></audio><small>اضغط تشغيل للاستماع. لا يبدأ الصوت تلقائيًا.</small></div>}{question.options && <div className="placement-options">{question.options.map((option, optionIndex) => <button key={option} type="button" className={response?.value === optionIndex ? 'selected' : ''} onClick={() => update(optionIndex)}>{String.fromCharCode(65 + optionIndex)}. {option}</button>)}</div>}{question.type === 'reorder' || question.type === 'short-text' ? <input className="placement-input" dir="rtl" value={typeof response?.value === 'string' ? response.value : ''} onChange={(event) => update(event.target.value)} placeholder="اكتب إجابتك هنا" /> : null}{question.type === 'writing' ? <><textarea className="placement-textarea" dir="rtl" value={typeof response?.value === 'string' ? response.value : ''} onChange={(event) => update(event.target.value)} placeholder="اكتب إجابتك هنا" /><small className="word-counter">Words: {wordCount} / {question.maxWords}</small></> : null}{question.type === 'speaking' ? <div className="recording-box"><p>اسمح للمتصفح باستعمال الميكروفون عند الاستعداد.</p>{recording ? <button type="button" className="record-button recording" onClick={stopRecording}>إيقاف التسجيل ({recordingSeconds} ثانية)</button> : <button type="button" className="record-button" disabled={uploading} onClick={startRecording}>{uploading ? 'جار رفع التسجيل…' : 'ابدأ التسجيل'}</button>}{response?.recordingPath && response.recordingPath !== 'pending-upload' && !recording && <span>تم رفع التسجيل بنجاح. يمكنك إعادة التسجيل.</span>}</div> : null}{error && <p className="placement-error" role="alert">{error}</p>}<div className="placement-actions"><button type="button" className="secondary-button" disabled={index === 0 || submitting} onClick={() => setIndex((current) => current - 1)}>Back</button>{index < placementQuestions.length - 1 ? <button type="button" className="primary-button" disabled={!answered || uploading || submitting} onClick={() => setIndex((current) => current + 1)}>Next</button> : <button type="button" className="primary-button" disabled={!answered || uploading || submitting} onClick={submit}>{submitting ? 'Submitting…' : 'Submit assessment'}</button>}</div></section></main>;
}
