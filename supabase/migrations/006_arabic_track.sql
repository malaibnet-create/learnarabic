alter table public.profiles add column if not exists arabic_track text not null default 'الفصحى' check (arabic_track in ('الفصحى','الدارجة','كلاهما'));
