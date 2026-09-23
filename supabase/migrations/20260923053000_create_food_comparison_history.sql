-- Account-level history of food comparison pages.
-- A/B and B/A are treated as the same pair through comparison_key.
-- Product IDs are intentionally generic UUIDs because cat and dog products live in separate master tables.
-- Brand/name snapshots keep the history readable even if a product is later renamed or removed.

create table if not exists public.food_comparison_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  species text not null check (species in ('cat', 'dog')),
  product_a_id uuid not null,
  product_b_id uuid not null,
  product_a_brand text,
  product_a_name text not null,
  product_b_brand text,
  product_b_name text not null,
  comparison_key text not null,
  compared_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint food_comparison_history_distinct_products
    check (product_a_id <> product_b_id),

  constraint food_comparison_history_user_pair_unique
    unique (user_id, species, comparison_key)
);

create index if not exists food_comparison_history_user_compared_idx
  on public.food_comparison_history(user_id, compared_at desc);

alter table public.food_comparison_history enable row level security;

drop policy if exists "users can read own comparison history" on public.food_comparison_history;
create policy "users can read own comparison history"
  on public.food_comparison_history
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users can add own comparison history" on public.food_comparison_history;
create policy "users can add own comparison history"
  on public.food_comparison_history
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "users can update own comparison history" on public.food_comparison_history;
create policy "users can update own comparison history"
  on public.food_comparison_history
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users can delete own comparison history" on public.food_comparison_history;
create policy "users can delete own comparison history"
  on public.food_comparison_history
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.food_comparison_history from anon;
grant select, insert, update, delete on public.food_comparison_history to authenticated;

comment on table public.food_comparison_history is
  'Account-level history of completed two-product comparison pages. Same pair is kept once and moved to the top when compared again.';
