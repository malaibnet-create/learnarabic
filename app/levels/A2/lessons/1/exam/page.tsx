import { redirect } from 'next/navigation';
import LevelTwoFinalExam from '../../../../../../components/level2/LevelTwoFinalExam';
import { createServerSupabaseClient } from '../../../../../../lib/supabase/server';

export default async function LevelTwoLessonOneFinalExamPage() {
  const authConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (!authConfigured) return <LevelTwoFinalExam />;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/levels/A2/lessons/1/exam');

  return <LevelTwoFinalExam />;
}
