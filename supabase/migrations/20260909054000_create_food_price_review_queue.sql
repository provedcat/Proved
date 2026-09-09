-- Human review queue for price candidates that cannot be safely promoted
-- to food_reference_prices by the automated collector.

create table if not exists public.food_price_review_queue (
  id uuid primary key default gen_random_uuid(),

  species text not null
    check (species in ('cat', 'dog')),
  feed_id uuid references public.feeds(id) on delete cascade,
  dog_feed_id uuid references public.dog_feeds(id) on delete cascade,

  issue_type text not null
    check (issue_type in (
      'discount_price_only',
      'ambiguous_product_match',
      'ambiguous_package',
      'conflicting_normal_prices',
      'price_outlier',
      'source_verification_required',
      'manual_review'
    )),

  source_type text
    check (source_type is null or source_type in (
      'coupang_official',
      'coupang_general',
      'brand_official',
      'importer_official'
    )),
  source_name text,
  source_url text
    check (source_url is null or source_url ~* '^https?://'),

  reason text not null
    check (btrim(reason) <> ''),
  candidate_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(candidate_data) = 'object'),

  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  review_action text
    check (review_action is null or review_action in (
      'accepted_reference',
      'rejected_candidate',
      'keep_existing_reference',
      'no_reliable_price'
    )),
  review_note text,
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint food_price_review_queue_product_target_check
    check (
      (species = 'cat' and feed_id is not null and dog_feed_id is null)
      or
      (species = 'dog' and dog_feed_id is not null and feed_id is null)
    ),
  constraint food_price_review_queue_review_state_check
    check (
      (status = 'open' and review_action is null and reviewed_at is null)
      or
      (status in ('resolved', 'dismissed') and review_action is not null and reviewed_at is not null)
    )
);

create unique index if not exists food_price_review_queue_open_feed_issue_uidx
  on public.food_price_review_queue(feed_id, issue_type)
  where feed_id is not null and status = 'open';

create unique index if not exists food_price_review_queue_open_dog_feed_issue_uidx
  on public.food_price_review_queue(dog_feed_id, issue_type)
  where dog_feed_id is not null and status = 'open';

create index if not exists food_price_review_queue_status_created_idx
  on public.food_price_review_queue(status, created_at);

create or replace function public.touch_food_price_review_queue_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.touch_food_price_review_queue_updated_at() from public, anon, authenticated;

drop trigger if exists touch_food_price_review_queue_updated_at
  on public.food_price_review_queue;
create trigger touch_food_price_review_queue_updated_at
before update on public.food_price_review_queue
for each row execute function public.touch_food_price_review_queue_updated_at();

alter table public.food_price_review_queue enable row level security;

-- Explicitly private to client roles. The backend service role bypasses RLS and
-- will create/resolve queue items during collection and administrator review.
create policy "food price review queue is private"
on public.food_price_review_queue
for all
to public
using (false)
with check (false);

revoke all on public.food_price_review_queue from anon, authenticated;

comment on table public.food_price_review_queue is
  'Private human-review queue for price candidates that fail Proved automatic pricing rules.';

comment on column public.food_price_review_queue.candidate_data is
  'Snapshot of candidate listing evidence required for review; not approved reference-price master data.';

comment on column public.food_price_review_queue.issue_type is
  'Reason automatic pricing stopped. discount_price_only is used when only a discounted current price is visible and a normal price cannot be established.';
