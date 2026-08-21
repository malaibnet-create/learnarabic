import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import PlacementTest from '../../components/placement/PlacementTest';

export default async function PlacementTestPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/placement-test');
  return <PlacementTest />;
}
