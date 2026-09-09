-- Proved reference pricing master.
-- Stores only the selected, verified normal-price reference for each product.
-- Candidate seller listings and temporary discounts are intentionally not persisted here.
--
-- Pricing policy represented by this schema:
-- - Domestic normal selling prices only.
-- - Coupang official/general sellers first; brand/importer official stores are fallback sources.
-- - Discounts (sale/coupon/WOW/instant discount) are excluded before a row is written here.
-- - Wet food: prefer a single unit; if none exists, normalize the smallest eligible pack to one unit.
-- - Dry food: select a 1,000-2,000 g package; if none exists, select the package closest to 2,000 g.
-- - Shipping fees are not included.
-- - Out-of-stock products keep the existing reference price until a newly available normal price is verified.

create table if not exists public.food_reference_prices (
  id uuid primary key default gen_random_uuid(),

  species text not null
    check (species in ('cat', 'dog')),
  feed_id uuid references public.feeds(id) on delete cascade,
  dog_feed_id uuid references public.dog_feeds(id) on delete cascade,

  source_type text not null
    check (source_type in (
      'coupang_official',
      'coupang_general',
      'brand_official',
      'importer_official'
    )),
  source_name text not null
    check (btrim(source_name) <> ''),
  source_url text not null
    check (source_url ~* '^https?://'),

  source_pack_price_krw numeric(12,2) not null
    check (source_pack_price_krw > 0),
  source_pack_count integer not null default 1
    check (source_pack_count > 0),
  unit_weight_g numeric(10,2) not null
    check (unit_weight_g > 0),

  reference_method text not null
    check (reference_method in ('single_unit', 'pack_normalized')),
  selection_basis text not null
    check (selection_basis in (
      'wet_single_unit',
      'wet_smallest_pack',
      'dry_1_2kg',
      'dry_nearest_2kg',
      'manual_review'
    )),

  reference_price_krw numeric(12,2)
    generated always as (
      round(source_pack_price_krw / source_pack_count::numeric, 2)
    ) stored,
  price_per_100g_krw numeric(12,2)
    generated always as (
      round(
        ((source_pack_price_krw / source_pack_count::numeric) / unit_weight_g) * 100,
        2
      )
    ) stored,

  availability_status text not null default 'unknown'
    check (availability_status in ('in_stock', 'out_of_stock', 'unknown')),

  verified_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint food_reference_prices_product_target_check
    check (
      (species = 'cat' and feed_id is not null and dog_feed_id is null)
      or
      (species = 'dog' and dog_feed_id is not null and feed_id is null)
    ),
  constraint food_reference_prices_method_pack_check
    check (
      (reference_method = 'single_unit' and source_pack_count = 1)
      or
      (reference_method = 'pack_normalized' and source_pack_count > 1)
    )
);

create unique index if not exists food_reference_prices_feed_id_uidx
  on public.food_reference_prices(feed_id)
  where feed_id is not null;

create unique index if not exists food_reference_prices_dog_feed_id_uidx
  on public.food_reference_prices(dog_feed_id)
  where dog_feed_id is not null;

create index if not exists food_reference_prices_last_checked_idx
  on public.food_reference_prices(last_checked_at);

create or replace function public.touch_food_reference_prices_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.touch_food_reference_prices_updated_at() from public, anon, authenticated;

drop trigger if exists touch_food_reference_prices_updated_at
  on public.food_reference_prices;
create trigger touch_food_reference_prices_updated_at
before update on public.food_reference_prices
for each row execute function public.touch_food_reference_prices_updated_at();

alter table public.food_reference_prices enable row level security;

create policy "food reference prices are publicly readable"
on public.food_reference_prices
for select
to public
using (true);

revoke insert, update, delete, truncate, references, trigger
  on public.food_reference_prices
  from anon, authenticated;
grant select on public.food_reference_prices to anon, authenticated;

comment on table public.food_reference_prices is
  'One verified Proved reference price per cat/dog food. Temporary sale prices and candidate listings are screened out before persistence.';

comment on column public.food_reference_prices.reference_price_krw is
  'Normalized price per one food unit. For a multipack, source_pack_price_krw / source_pack_count.';

comment on column public.food_reference_prices.price_per_100g_krw is
  'Reference price normalized to 100 g for cross-package and My Score calculations.';

comment on column public.food_reference_prices.unit_weight_g is
  'Weight of one normalized unit: one can/pouch for wet food or the selected bag weight for dry food.';
