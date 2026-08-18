'use client';

import { useEffect, useState } from 'react';
import { darijaLessons } from '../../../data/darija/lessons';

const progressKey = 'darlugha-darija-progress';

export default function DarijaLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const [lessonId, setLessonId] = useState(1); const [selected, setSelected] = useState<Record<string, number>>({}); const [message, setMessage] = useState(''); const [completed, setCompleted] = useState<number[]>([]);
  useEffect(() => { params.then(({lessonId: id}) => setLessonId(Number(id))); const saved = localStorage.getItem(progressKey); if (saved) setCompleted(JSON.parse(saved)); }, [params]);
  const lesson = darijaLessons.find((item) => item.id === lessonId) ?? darijaLessons[0]; const unlocked = lesson.id === 1 || completed.includes(lesson.id - 1); const allAnswered = lesson.questions.every((question) => selected[question.id] !== undefined);
  function finish() { if (!allAnswered) return setMessage('أجب عن جميع أسئلة الفيديو أولًا.'); const correct = lesson.questions.every((question) => selected[question.id] === question.correctIndex); if (!correct) return setMessage('راجع إجاباتك ثم حاول مرة أخرى.'); const next = Array.from(new Set([...completed, lesson.id])); localStorage.setItem(progressKey, JSON.stringify(next)); setCompleted(next); setMessage('أحسنت! تم فتح الدرس التالي.'); }
  if (!unlocked) return <main className="shell"><section className="locked-page"><h1>هذا الدرس مقفل 🔒</h1><p>أكمل الدرس السابق أولًا لفتحه.</p><a className="button" href="/darija-lessons">العودة إلى الدروس</a></section></main>;
  return <main className="shell darija-page"><a className="back-link" href="/darija-lessons">← كل دروس الدارجة</a><section className="lesson-view"><div className="eyebrow">الدرس {lesson.id} من 30</div><h1>{lesson.title}</h1><p>{lesson.description}</p>{lesson.videoUrl ? <div className="video-frame"><iframe src={lesson.videoUrl} title={lesson.title} allowFullScreen /></div> : <div className="video-placeholder">ضع رابط فيديو يوتيوب هنا لاحقًا<br/><small>مثال: https://www.youtube.com/embed/VIDEO_ID</small></div>}<div className="lesson-questions"><h2>أسئلة الفيديو</h2>{lesson.questions.map((question, index) => <div className="darija-question" key={question.id}><strong>{index + 1}. {question.prompt}</strong>{question.options.map((option, optionIndex) => <button className={selected[question.id] === optionIndex ? 'selected' : ''} key={option} onClick={() => { setSelected((current) => ({...current, [question.id]: optionIndex})); setMessage(''); }}>{option}</button>)}</div>)}<button className="primary-button" disabled={!allAnswered} onClick={finish}>إرسال الإجابات وفتح الدرس التالي</button>{message && <p className="lesson-message">{message}</p>}</div></section></main>;
}
