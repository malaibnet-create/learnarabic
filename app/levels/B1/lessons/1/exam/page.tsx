import { redirect } from 'next/navigation';
import LevelThreeFinalExam from '../../../../../../components/level3/LevelThreeFinalExam';
import { createServerSupabaseClient } from '../../../../../../lib/supabase/server';

export default async function LevelThreeLessonOneFinalExamPage() {
  const authConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!authConfigured) return <LevelThreeFinalExam />;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/levels/B1/lessons/1/exam');

  return <LevelThreeFinalExam />;
}
