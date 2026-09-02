'use client';

import { useEffect, useState } from 'react';

const questions = [
  ['مَا مَعْنَى «أَدْرُسُ»؟', ['I study', 'I work', 'I live'], 0],
  ['اختر الجملة الصحيحة:', ['أَنَا يَعْمَلُ', 'أَنَا أَدْرُسُ', 'أَنَا تَعْمَلِينَ'], 1],
  ['أكمل: أَسْكُنُ فِي مَدِينَةِ ...', ['مَكْنَاسَ', 'عُمْرٌ', 'جِنْسِيَّةٌ'], 0],
] as const;

export default function LessonExamPage({ params }: { params: Promise<{ levelCode: string }> }) {
  const [code, setCode] = useState('A1');
  const [lesson, setLesson] = useState('1');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState('');

  useEffect(() => {
    params.then(({ levelCode }) => {
      setCode(levelCode.toUpperCase());
      const value = new URLSearchParams(window.location.search).get('lesson');
      if (value) setLesson(value);
    });
  }, [params]);

  function submit() {
    const score = questions.reduce((total, question, index) => total + (answers[index] === question[2] ? 1 : 0), 0);
    if (score >= 2) {
      localStorage.setItem(`darlugha-${code.toLowerCase()}-lesson-${lesson}-exam`, 'passed');
      setResult(`أحسنت! نجحت بنتيجة ${score} من ${questions.length}. تم فتح الدرس التالي.`);
    } else setResult(`نتيجتك ${score} من ${questions.length}. تحتاج إلى إجابتين صحيحتين على الأقل. راجع الدرس وحاول مرة أخرى.`);
  }

  return <main className="shell"><section className="auth-page lesson-exam-page"><a className="back-link" href={`/levels/${code}#lesson-${lesson}`}>← العودة إلى الدرس</a><div className="eyebrow">امتحان الدرس {lesson} · المستوى {code}</div><h1>اختبر ما تعلّمته</h1><p>أجب عن الأسئلة الثلاثة. النجاح يفتح الدرس التالي.</p>{questions.map(([prompt, choices], index) => <fieldset className="exam-question" key={prompt}><legend>{index + 1}. {prompt}</legend>{choices.map((choice, choiceIndex) => <label key={choice}><input type="radio" name={`q-${index}`} checked={answers[index] === choiceIndex} onChange={() => setAnswers(previous => ({ ...previous, [index]: choiceIndex }))} /> {choice}</label>)}</fieldset>)}{result && <p className="lesson-message">{result}</p>}<button className="button" type="button" onClick={submit} disabled={Object.keys(answers).length < questions.length}>تصحيح الامتحان</button></section></main>;
}
