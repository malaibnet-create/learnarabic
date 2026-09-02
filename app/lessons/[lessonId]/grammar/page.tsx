'use client';

import { useParams, useSearchParams } from 'next/navigation';
import GrammarLesson from '../../../../components/lesson1/GrammarLesson';
import LessonTwoGrammar from '../../../../components/lesson2/LessonTwoGrammar';

export default function GrammarPage() {
  const params = useParams<{ lessonId: string }>();
  const searchParams = useSearchParams();
  if (params.lessonId === '2') return <main className="shell"><LessonTwoGrammar /></main>;
  return <main className="shell"><GrammarLesson ruleId={searchParams.get('rule') || undefined} /></main>;
}
