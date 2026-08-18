alter table public.profiles add column if not exists age int;
alter table public.profiles add column if not exists started_learning text;
alter table public.profiles add column if not exists learning_goal text;
alter table public.profiles add column if not exists interests text[] default '{}';
alter table public.profiles add column if not exists weekly_minutes int;
alter table public.profiles add column if not exists preferred_style text;
