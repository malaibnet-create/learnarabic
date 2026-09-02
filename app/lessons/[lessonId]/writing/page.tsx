import { redirect } from 'next/navigation';

export default async function WritingPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  redirect(`/levels/A1?lesson=${lessonId}`);
}
