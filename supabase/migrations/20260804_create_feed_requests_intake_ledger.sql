create table if not exists public.feed_requests (
  id uuid primary key default gen_random_uuid(),
  request_text text not null check (char_length(btrim(request_text)) between 2 and 120),
  species text not null check (species in ('cat', 'dog')),
  feed_type text not null check (feed_type in ('dry', 'wet')),
  user_id uuid null references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'registered', 'needs_review', 'duplicate')),
  result_table text null check (result_table is null or result_table in ('feeds', 'dog_feeds')),
  result_feed_ids uuid[] not null default '{}'::uuid[],
  error_detail text null,
  created_at timestamptz not null default now(),
  processed_at timestamptz null
);

comment on table public.feed_requests is
  'Immutable intake ledger for every product-name feed request, including requests Gemini cannot resolve.';

alter table public.feed_requests enable row level security;

revoke all on table public.feed_requests from anon, authenticated;
grant all on table public.feed_requests to service_role;

create index if not exists feed_requests_created_at_idx
  on public.feed_requests (created_at desc);
create index if not exists feed_requests_status_created_at_idx
  on public.feed_requests (status, created_at desc);
create index if not exists feed_requests_user_id_created_at_idx
  on public.feed_requests (user_id, created_at desc)
  where user_id is not null;
