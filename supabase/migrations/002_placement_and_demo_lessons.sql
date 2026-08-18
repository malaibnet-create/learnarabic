create table if not exists public.placement_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  score int not null check (score between 0 and 100),
  recommended_level text not null check (recommended_level in ('A1','A2','B1')),
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.lessons (level_id,title,objectives,sort_order,published)
select id,'التحية والتعارف','التعريف بالنفس واستخدام عبارات التحية الأساسية',1,true from public.levels where code='A1'
and not exists (select 1 from public.lessons where title='التحية والتعارف');

insert into public.lessons (level_id,title,objectives,sort_order,published)
select id,'في المنزل','وصف المنزل والأشياء اليومية',2,true from public.levels where code='A1'
and not exists (select 1 from public.lessons where title='في المنزل');

insert into public.lessons (level_id,title,objectives,sort_order,published)
select id,'يومي وروتيني','التحدث عن الأنشطة اليومية والوقت',3,true from public.levels where code='A1'
and not exists (select 1 from public.lessons where title='يومي وروتيني');
