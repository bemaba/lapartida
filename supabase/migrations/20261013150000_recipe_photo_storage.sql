-- Storage for recipe photos.
-- The bucket is public so the app can display images without signed URLs.
-- Only authenticated users with an active La Partida profile can upload; each user
-- can update/delete files inside their own user-id folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-photos',
  'recipe-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Active users can upload recipe photos" on storage.objects;
create policy "Active users can upload recipe photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'recipe-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.active = true
  )
);

drop policy if exists "Users can update own recipe photos" on storage.objects;
create policy "Users can update own recipe photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'recipe-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.active = true
  )
)
with check (
  bucket_id = 'recipe-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.active = true
  )
);

drop policy if exists "Users can delete own recipe photos" on storage.objects;
create policy "Users can delete own recipe photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'recipe-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.active = true
  )
);
