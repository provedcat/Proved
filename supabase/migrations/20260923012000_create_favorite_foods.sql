-- User-level favorite foods for Proved.
-- Favorites belong to the account, not to an individual pet.
-- Cat and dog foods are stored together and ordered by created_at in My Page.

create table if not exists public.favorite_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  species text not null check (species in ('cat', 'dog')),
  feed_id uuid references public.feeds(id) on delete cascade,
  dog_feed_id uuid references public.dog_feeds(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint favorite_foods_product_target_check
    check (
      (species = 'cat' and feed_id is not null and dog_feed_id is null)
      or
      (species = 'dog' and dog_feed_id is not null and feed_id is null)
    )
);

create unique index if not exists favorite_foods_user_feed_uidx
  on public.favorite_foods(user_id, feed_id)
  where feed_id is not null;

create unique index if not exists favorite_foods_user_dog_feed_uidx
  on public.favorite_foods(user_id, dog_feed_id)
  where dog_feed_id is not null;

create index if not exists favorite_foods_user_created_idx
  on public.favorite_foods(user_id, created_at desc);

alter table public.favorite_foods enable row level security;

drop policy if exists "users can read own favorite foods" on public.favorite_foods;
create policy "users can read own favorite foods"
  on public.favorite_foods
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users can add own favorite foods" on public.favorite_foods;
create policy "users can add own favorite foods"
  on public.favorite_foods
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "users can delete own favorite foods" on public.favorite_foods;
create policy "users can delete own favorite foods"
  on public.favorite_foods
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.favorite_foods from anon;
grant select, insert, delete on public.favorite_foods to authenticated;

comment on table public.favorite_foods is
  'Account-level favorites across cat and dog foods. Not assigned to an individual pet; My Page shows them together by favorite time.';
