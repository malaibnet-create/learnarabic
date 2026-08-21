create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  full_name text not null,
  email text,
  bio text,
  photo_url text,
  skills text[] not null default '{}',
  tracks text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id),
  lesson_type text not null check (lesson_type in ('individual','group')),
  skill text not null,
  start_date date not null,
  timezone text not null default 'Africa/Casablanca',
  weekly_frequency int not null check (weekly_frequency between 1 and 3),
  weeks_count int not null check (weeks_count in (1,4,8,12)),
  notes text,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.booking_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  scheduled_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  unique(booking_id, scheduled_date, start_time)
);

insert into public.teachers (slug, full_name, email, bio, photo_url, skills, tracks)
values
  ('othman-ben-fqir', 'عثمان بن فقير', 'ohthmanbnfakir@gmail.com', 'مدرس العربية واللسانيات ومتخصص في تعليم العربية للناطقين بغيرها وتقييم الكفاءة اللغوية.', '/teachers/othman-ben-fqir.jpg', array['المحادثة','القراءة','الكتابة','الاستماع','القواعد'], array['الفصحى','الدارجة','كلاهما']),
  ('yousra-benoura', 'يسرى بنورة', null, 'مدرسة العربية للناطقين بغيرها بمنهج تواصلي يركز على احتياجات الطالب.', null, array['المحادثة','القراءة','الكتابة','القواعد'], array['الفصحى','الدارجة'])
on conflict (slug) do update set full_name=excluded.full_name, email=excluded.email, bio=excluded.bio, photo_url=excluded.photo_url, skills=excluded.skills, tracks=excluded.tracks;

alter table public.teachers enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_sessions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='teachers' and policyname='anyone can read active teachers') then
    create policy "anyone can read active teachers" on public.teachers for select using (active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bookings' and policyname='students can create own bookings') then
    create policy "students can create own bookings" on public.bookings for insert to authenticated with check (auth.uid() = student_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bookings' and policyname='students can read own bookings') then
    create policy "students can read own bookings" on public.bookings for select to authenticated using (auth.uid() = student_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='booking_sessions' and policyname='students can create sessions for own bookings') then
    create policy "students can create sessions for own bookings" on public.booking_sessions for insert to authenticated with check (exists (select 1 from public.bookings where bookings.id = booking_id and bookings.student_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='booking_sessions' and policyname='students can read sessions for own bookings') then
    create policy "students can read sessions for own bookings" on public.booking_sessions for select to authenticated using (exists (select 1 from public.bookings where bookings.id = booking_id and bookings.student_id = auth.uid()));
  end if;
end $$;
