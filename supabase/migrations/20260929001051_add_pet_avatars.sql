alter table public.pets
  add column if not exists avatar_settings jsonb,
  add column if not exists avatar_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-avatars', 'pet-avatars', true, 1048576, array['image/webp'])
on conflict (id) do nothing;

create policy "Users upload own pet avatars"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pet-avatars'
    and storage.extension(name) = 'webp'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(name))[2]
        and p.user_id = (select auth.uid())
    )
  );

create policy "Users delete own pet avatars"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'pet-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users select own pet avatars"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pet-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
