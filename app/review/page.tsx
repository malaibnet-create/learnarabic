'use client';

import { useEffect, useRef, useState } from 'react';
import { lessonOneVocabulary } from '../../data/lesson1/vocabulary';
import { lessonTwoVocabulary } from '../../data/lesson2/vocabulary';
import { getReviewItems, removeReviewItem, upsertReviewItem, type ReviewItem } from '../../lib/learning-progress';
import './review.css';

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'A1' | 'A2' | 'B1'>('all');
  const [playing, setPlaying] = useState('');
  const [audioError, setAudioError] = useState('');
  const player = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    migrateLegacyReview();
    const refresh = () => setItems(getReviewItems());
    refresh();
    window.addEventListener('darlugha-review-changed', refresh);
    return () => { window.removeEventListener('darlugha-review-changed', refresh); player.current?.pause(); };
  }, []);

  function play(item: ReviewItem) {
    if (!item.audioUrl) { setAudioError('لا يوجد تسجيل لهذا العنصر حاليًا. · Audio is not available for this item yet.'); return; }
    if (!player.current) {
      player.current = new Audio();
      player.current.preload = 'none';
      player.current.onended = () => setPlaying('');
      player.current.onerror = () => { setPlaying(''); setAudioError('تعذر تشغيل التسجيل. · The audio could not be played.'); };
    }
    player.current.pause();
    player.current.src = item.audioUrl;
    player.current.currentTime = 0;
    setAudioError('');
    setPlaying(item.id);
    void player.current.play().catch(() => { setPlaying(''); setAudioError('تعذر تشغيل التسجيل. · The audio could not be played.'); });
  }

  const visible = filter === 'all' ? items : items.filter(item => item.level === filter);

  return <main className="shell review-page">
    <header className="topbar"><a className="brand" href="/dashboard"><span className="brand-mark">ع</span><span>Dar<span>Lugha</span></span></a><a className="link" href="/dashboard">العودة إلى اللوحة · Dashboard</a></header>
    <section className="review-hero"><div><div className="eyebrow">مراجعتك الشخصية · Your review collection</div><h1>المراجعة</h1><p>كل كلمة أو عبارة تضيفها من الدروس ستبقى هنا حتى تزيلها بنفسك.</p><p dir="ltr">Everything you add from a lesson stays here until you remove it.</p></div><strong>{items.length}</strong></section>
    <nav className="review-filters" aria-label="تصفية عناصر المراجعة">{(['all', 'A1', 'A2', 'B1'] as const).map(value => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'الكل · All' : value}</button>)}</nav>
    {audioError && <p className="review-audio-error" role="alert">{audioError}</p>}
    {visible.length === 0 ? <section className="review-empty"><span>🔖</span><h2>لا توجد عناصر هنا بعد</h2><p>اضغط «أضف إلى المراجعة» داخل أي درس، وسيظهر العنصر هنا.</p><a className="button" href="/lessons">اذهب إلى الدروس · Go to lessons</a></section> : <section className="review-grid">{visible.map(item => <article className="review-card" key={item.id}><div className="review-card-meta"><span>{item.level}</span><span>الدرس {item.lesson} · Lesson {item.lesson}</span></div><h2>{item.arabic}</h2>{item.english && <p dir="ltr">{item.english}</p>}{item.example && <blockquote>{item.example}</blockquote>}<div className="review-card-actions"><button className="review-button" onClick={() => play(item)}>{playing === item.id ? '🔊 Playing…' : '🔊 Play'}</button><button className="review-remove" onClick={() => removeReviewItem(item.id)}>إزالة · Remove</button></div></article>)}</section>}
  </main>;
}

function migrateLegacyReview() {
  try {
    const lessonOneIds = JSON.parse(localStorage.getItem('darlugha-lesson-1-vocabulary-review') || '[]') as number[];
    lessonOneVocabulary.filter(item => lessonOneIds.includes(item.id)).forEach(item => upsertReviewItem({ id: `a1-l1-vocabulary-${item.id}`, level: 'A1', lesson: 1, section: 'vocabulary', arabic: item.word, english: item.meaning, example: item.example, audioUrl: item.audioUrl }));
    const lessonTwoSaved = JSON.parse(localStorage.getItem('darlugha-lesson-2-vocabulary') || '{}') as { review?: number[] };
    lessonTwoVocabulary.filter(item => lessonTwoSaved.review?.includes(item.id)).forEach(item => upsertReviewItem({ id: `a1-l2-vocabulary-${item.id}`, level: 'A1', lesson: 2, section: 'vocabulary', arabic: item.word, english: item.meaning, example: item.example, audioUrl: item.wordAudioUrl }));
  } catch { /* legacy review is optional */ }
}
