alter table public.placement_attempts add column if not exists listening_score int check (listening_score between 0 and 100);
alter table public.placement_attempts add column if not exists reading_score int check (reading_score between 0 and 100);
alter table public.placement_attempts add column if not exists writing_score int check (writing_score between 0 and 100);
alter table public.placement_attempts add column if not exists speaking_score int check (speaking_score between 0 and 100);
alter table public.placement_attempts add column if not exists listening_level text;
alter table public.placement_attempts add column if not exists reading_level text;
alter table public.placement_attempts add column if not exists writing_level text;
alter table public.placement_attempts add column if not exists speaking_level text;
alter table public.placement_attempts add column if not exists writing_responses jsonb;
alter table public.placement_attempts add column if not exists speaking_responses jsonb;
alter table public.placement_attempts add column if not exists ai_evaluation jsonb;
alter table public.placement_attempts drop constraint if exists placement_attempts_recommended_level_check;
alter table public.placement_attempts add constraint placement_attempts_recommended_level_check check (recommended_level in ('A1','A2','B1','B2'));

create table if not exists public.placement_skill_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.placement_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null check (skill in ('listening','reading','writing','speaking')),
  score int check (score between 0 and 100),
  cefr_level text check (cefr_level in ('A1','A2','B1','B2')),
  ai_evaluation jsonb,
  created_at timestamptz not null default now()
);

alter table public.placement_attempts enable row level security;
alter table public.placement_skill_results enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='placement_attempts' and policyname='students read own placement attempts') then
    create policy "students read own placement attempts" on public.placement_attempts for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='placement_attempts' and policyname='students insert own placement attempts') then
    create policy "students insert own placement attempts" on public.placement_attempts for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='placement_skill_results' and policyname='students read own skill results') then
    create policy "students read own skill results" on public.placement_skill_results for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='placement_skill_results' and policyname='students insert own skill results') then
    create policy "students insert own skill results" on public.placement_skill_results for insert with check (auth.uid() = user_id);
  end if;
end $$;
