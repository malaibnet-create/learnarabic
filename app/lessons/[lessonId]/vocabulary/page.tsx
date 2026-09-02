'use client';


import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { lessonOneVocabulary, workedConjugation, VocabularyItem } from '../../../../data/lesson1/vocabulary';
import VocabularyPractice from '../../../../components/lesson1/VocabularyPractice';
import LessonTwoVocabulary from '../../../../components/lesson2/LessonTwoVocabulary';
import { playArabic } from '../../../../lib/audio';
import { isInReview, markSectionStarted, removeReviewItem, upsertReviewItem } from '../../../../lib/learning-progress';

type LearningStatus = 'new' | 'learning' | 'mastered';
const statusLabels: Record<LearningStatus, string> = { new: 'New', learning: 'Learning', mastered: 'Mastered' };

function speak(text: string, audioUrl?: string) {
  if (!audioUrl) audioUrl = lessonOneVocabulary.find(item => item.example === text)?.exampleAudioUrl;
  return playArabic(text, audioUrl);
}

export default function LessonVocabularyPage() {
  const params = useParams<{ lessonId: string }>();
  const [statuses, setStatuses] = useState<Record<number, LearningStatus>>({});
  const [review, setReview] = useState<number[]>([]);

  useEffect(() => {
    try {
      const savedStatuses = localStorage.getItem('darlugha-lesson-1-vocabulary-status');
      const savedReview = localStorage.getItem('darlugha-lesson-1-vocabulary-review');
      if (savedStatuses) setStatuses(JSON.parse(savedStatuses));
      if (savedReview) setReview(JSON.parse(savedReview));
      setReview(items => Array.from(new Set([...items, ...lessonOneVocabulary.filter(item => isInReview(`a1-l1-vocabulary-${item.id}`)).map(item => item.id)])));
      markSectionStarted('A1', 1, 'vocabulary');
    } catch { /* local storage may be disabled */ }
  }, []);

  if (params.lessonId === '2') return <LessonTwoVocabulary />;

  function updateStatus(id: number, status: LearningStatus) {
    const next = { ...statuses, [id]: status };
    setStatuses(next);
    localStorage.setItem('darlugha-lesson-1-vocabulary-status', JSON.stringify(next));
  }

  function toggleReview(item: VocabularyItem) {
    const id = item.id;
    const next = review.includes(id) ? review.filter(item => item !== id) : [...review, id];
    setReview(next);
    localStorage.setItem('darlugha-lesson-1-vocabulary-review', JSON.stringify(next));
    const reviewId = `a1-l1-vocabulary-${id}`;
    if (review.includes(id)) removeReviewItem(reviewId);
    else upsertReviewItem({ id: reviewId, level: 'A1', lesson: 1, section: 'vocabulary', arabic: item.word, english: item.meaning, example: item.example, audioUrl: item.audioUrl });
  }

  return <main className="shell vocabulary-page">
    <header className="topbar"><a className="brand" href="/dashboard"><span className="brand-mark">ع</span><span>Dar<span>Lugha</span></span></a><a className="link" href="/levels/A1?lesson=1">← Lesson sections</a></header>
    <section className="vocabulary-hero"><div><div className="eyebrow">A1 · Lesson 1</div><h1>مفردات الدراسة والهوية</h1><p dir="ltr">Learn each word, listen to it, and read it in a short example. Set a learning status to track your progress.</p></div><div className="vocabulary-count"><strong>{Object.values(statuses).filter(status => status === 'mastered').length} / {lessonOneVocabulary.length}</strong><span>words mastered</span></div></section>
    <div className="status-legend" dir="ltr"><span><i className="status-dot new" /> New</span><span><i className="status-dot learning" /> Learning</span><span><i className="status-dot mastered" /> Mastered</span><a href="/review">🔖 {review.length} in review</a></div>
    <section className="vocabulary-grid">{lessonOneVocabulary.map(item => <VocabularyCard key={item.id} item={item} status={statuses[item.id] || 'new'} isReview={review.includes(item.id)} onStatus={status => updateStatus(item.id, status)} onReview={() => toggleReview(item)} />)}</section>
    <VocabularyPractice />
    <section className="conjugation-section"><div className="eyebrow">Quick practice</div><h2>تصريف الفعل «عَمِلَ»</h2><p dir="ltr">Select any row to hear the pronoun and verb together.</p><div className="conjugation-table" role="table"><div className="conjugation-row heading" role="row"><strong>Pronoun</strong><strong>Verb</strong><strong>Meaning</strong></div>{workedConjugation.map(([pronoun, verb, meaning]) => <button className="conjugation-row" type="button" role="row" key={pronoun} onClick={() => speak(`${pronoun} ${verb}`)}><span>{pronoun}</span><b>{verb}</b><span>{meaning}</span><span aria-hidden="true">🔊</span></button>)}</div></section>
  </main>;
}

function VocabularyCard({ item, status, isReview, onStatus, onReview }: { item: VocabularyItem; status: LearningStatus; isReview: boolean; onStatus: (status: LearningStatus) => void; onReview: () => void }) {
  return <article className={`vocabulary-card ${status}`}><div className="card-top"><span className={`status-pill ${status}`}><i className="status-dot" />{statusLabels[status]}</span>{item.visualType !== 'none' && <span className="vocabulary-visual" aria-label={item.visual}>{item.visual}</span>}</div><div className="word-line"><h2>{item.word}</h2><button type="button" className="sound-button" onClick={() => speak(item.word, item.audioUrl)} aria-label={`Play the word ${item.word}`}>🔊</button></div><p className="meaning">{item.meaning}</p><div className="example"><div className="example-line"><p>{item.example}</p><button type="button" className="sound-button" onClick={() => speak(item.example)} aria-label={`Play the example for ${item.word}`}>🔊</button></div><span>{item.translation}</span></div>{item.note && <p className="vocabulary-note">💡 {item.note}</p>}<div className="card-actions"><button type="button" className={isReview ? 'review-button saved' : 'review-button'} onClick={onReview}>{isReview ? '✓ In review' : '🔖 Add to review'}</button><select value={status} onChange={event => onStatus(event.target.value as LearningStatus)} aria-label={`Learning status for ${item.word}`}><option value="new">New</option><option value="learning">Learning</option><option value="mastered">Mastered</option></select></div></article>;
}
