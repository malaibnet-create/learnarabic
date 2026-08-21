-- Create a profile automatically for every new Supabase Auth user.
alter table public.profiles add column if not exists age int;
alter table public.profiles add column if not exists started_learning text;
alter table public.profiles add column if not exists learning_goal text;
alter table public.profiles add column if not exists interests text[] default '{}';
alter table public.profiles add column if not exists arabic_track text not null default 'الفصحى';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, age, started_learning, learning_goal, interests, arabic_track)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'student',
    nullif(new.raw_user_meta_data->>'age', '')::int,
    new.raw_user_meta_data->>'started_learning',
    new.raw_user_meta_data->>'learning_goal',
    case when coalesce(new.raw_user_meta_data->>'interests', '') = '' then '{}'::text[]
         else array[new.raw_user_meta_data->>'interests'] end,
    case when new.raw_user_meta_data->>'arabic_track' in ('الفصحى', 'الدارجة', 'كلاهما')
         then new.raw_user_meta_data->>'arabic_track' else 'الفصحى' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for accounts created before this migration.
insert into public.profiles (id, full_name, role)
select id, coalesce(raw_user_meta_data->>'full_name', ''), 'student'
from auth.users
where not exists (select 1 from public.profiles where profiles.id = users.id);

alter table public.profiles enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='students can read own profile') then
    create policy "students can read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='students can insert own profile') then
    create policy "students can insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='students can update own profile') then
    create policy "students can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
  end if;
end $$;
