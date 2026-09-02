'use client';

import { useParams } from 'next/navigation';
import ReadingLesson from '../../../../components/lesson1/ReadingLesson';
import LessonTwoReading from '../../../../components/lesson2/LessonTwoReading';

export default function ReadingPage() {
  const params = useParams<{ lessonId: string }>();
  if (params.lessonId === '2') return <main className="shell"><LessonTwoReading /></main>;
  return <main className="shell"><ReadingLesson /></main>;
}
