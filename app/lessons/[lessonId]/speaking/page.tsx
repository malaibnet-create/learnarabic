'use client';

import { useParams } from 'next/navigation';
import SpeakingLesson from '../../../../components/lesson1/SpeakingLesson';
import LessonTwoConversation from '../../../../components/lesson2/LessonTwoConversation';

export default function SpeakingPage() {
  const params = useParams<{ lessonId: string }>();
  if (params.lessonId === '2') return <main className="shell"><LessonTwoConversation /></main>;
  return <main className="shell"><SpeakingLesson /></main>;
}
