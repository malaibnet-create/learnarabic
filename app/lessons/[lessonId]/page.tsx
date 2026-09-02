import { redirect } from 'next/navigation';

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  redirect(`/levels/A1?lesson=${lessonId}`);
}
