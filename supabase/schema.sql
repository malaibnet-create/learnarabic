create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'student' check (role in ('student','admin','teacher')),
  created_at timestamptz not null default now()
);

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  description text,
  sort_order int not null,
  published boolean not null default false
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id) on delete cascade,
  title text not null,
  objectives text,
  sort_order int not null,
  published boolean not null default false
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  status text not null default 'not_started',
  percent int not null default 0 check (percent between 0 and 100),
  score int,
  completed_at timestamptz,
  unique(user_id, lesson_id)
);

create table if not exists public.placement_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  score int not null check (score between 0 and 100),
  recommended_level text not null check (recommended_level in ('A1','A2','B1')),
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.levels (code,title,description,sort_order,published)
values ('A1','المستوى A1','أساسيات العربية للمبتدئين',1,true)
on conflict (code) do nothing;

insert into public.lessons (level_id,title,objectives,sort_order,published)
select id,'التحية والتعارف','التعريف بالنفس واستخدام عبارات التحية الأساسية',1,true from public.levels where code='A1'
and not exists (select 1 from public.lessons where title='التحية والتعارف');

insert into public.lessons (level_id,title,objectives,sort_order,published)
select id,'في المنزل','وصف المنزل والأشياء اليومية',2,true from public.levels where code='A1'
and not exists (select 1 from public.lessons where title='في المنزل');

insert into public.lessons (level_id,title,objectives,sort_order,published)
select id,'يومي وروتيني','التحدث عن الأنشطة اليومية والوقت',3,true from public.levels where code='A1'
and not exists (select 1 from public.lessons where title='يومي وروتيني');
