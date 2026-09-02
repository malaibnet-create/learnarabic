 'use client';

import { useParams } from 'next/navigation';
import ListeningLesson from '../../../../components/lesson1/ListeningLesson';
import LessonTwoListening from '../../../../components/lesson2/LessonTwoListening';

export default function ListeningPage() {
  const params = useParams<{ lessonId: string }>();
  if (params.lessonId === '2') return <main className="shell"><LessonTwoListening /></main>;
  return <main className="shell"><ListeningLesson /></main>;
}
