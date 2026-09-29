-- Qualify the outer Storage object name: unqualified name inside EXISTS resolves to pets.name.
alter policy "Users upload own pet avatars"
  on storage.objects
  with check (
    bucket_id = 'pet-avatars'
    and storage.extension(name) = 'webp'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
        and p.user_id = (select auth.uid())
    )
  );
