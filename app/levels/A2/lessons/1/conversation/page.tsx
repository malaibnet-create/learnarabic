import { redirect } from 'next/navigation';
import LevelTwoLessonOneConversationRoom, { type RoomConfig } from '../../../../../../components/level2/LevelTwoLessonOneConversationRoom';
import { getSafeConversationRoomConfig } from '../../../../../../data/level2/conversation-room-safe';
import { createServerSupabaseClient } from '../../../../../../lib/supabase/server';

export default async function LevelTwoConversationPage() {
  const initialConfig = getSafeConversationRoomConfig() as RoomConfig;
  const authConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!authConfigured) return <LevelTwoLessonOneConversationRoom initialConfig={initialConfig} />;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/levels/A2/lessons/1/conversation');

  return <LevelTwoLessonOneConversationRoom initialConfig={initialConfig} />;
}
