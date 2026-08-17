-- Run this only after creating the two buckets in Supabase Storage.
-- The audio bucket is public; student recordings remain private.
insert into storage.buckets (id, name, public)
values ('placement-audio', 'placement-audio', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('placement-recordings', 'placement-recordings', false)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='public can read placement audio') then
    create policy "public can read placement audio" on storage.objects for select using (bucket_id = 'placement-audio');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='students upload own placement recordings') then
    create policy "students upload own placement recordings" on storage.objects for insert to authenticated with check (bucket_id = 'placement-recordings' and (storage.foldername(name))[1] = (select auth.uid()::text));
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='students read own placement recordings') then
    create policy "students read own placement recordings" on storage.objects for select to authenticated using (bucket_id = 'placement-recordings' and (storage.foldername(name))[1] = (select auth.uid()::text));
  end if;
end $$;
