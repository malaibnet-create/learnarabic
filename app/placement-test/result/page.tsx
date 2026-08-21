import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '../../../lib/supabase/server';

export default async function PlacementResultPage({ searchParams }: { searchParams: Promise<{ attempt?: string }> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/placement-test');
  const { data: attempt } = await supabase.from('placement_attempts').select('recommended_level,score,listening_score,reading_score,writing_score,speaking_score').eq('id', params.attempt ?? '').eq('user_id', user.id).single();
  if (!attempt) redirect('/placement-test');
  return <main className="shell"><section className="placement-result"><div className="eyebrow">Assessment submitted</div><h1>Arabic Placement Test Result</h1><div className="recommended-level"><small>Recommended starting level</small><strong>{attempt.recommended_level}</strong></div><p>Your objective sections were saved. Writing and speaking scores will be finalized after secure AI evaluation is configured.</p><div className="skill-results"><div>Listening <b>{attempt.listening_score ?? '—'}</b></div><div>Reading <b>{attempt.reading_score ?? '—'}</b></div><div>Writing <b>{attempt.writing_score ?? 'Pending'}</b></div><div>Speaking <b>{attempt.speaking_score ?? 'Pending'}</b></div></div><div className="actions"><Link className="button" href={`/levels/${attempt.recommended_level}`}>Start Learning at {attempt.recommended_level}</Link><Link className="link" href="/dashboard">Return to dashboard</Link></div></section></main>;
}
