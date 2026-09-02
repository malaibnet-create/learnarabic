import { redirect } from 'next/navigation';
import VoiceConversationRoom from '../../../../../../components/level3/VoiceConversationRoom';
import { createServerSupabaseClient } from '../../../../../../lib/supabase/server';

export default async function LevelThreeConversationPage() {
  const authConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!authConfigured) return <VoiceConversationRoom />;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/levels/B1/lessons/1/conversation');
  return <VoiceConversationRoom />;
}
