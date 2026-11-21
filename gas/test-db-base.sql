create role anon;
create role authenticated;
create role service_role bypassrls;
grant usage on schema public to service_role;
create table public.feeds(id uuid primary key);
create table public.dog_feeds(id uuid primary key);
create table public.food_reference_prices(
 id uuid primary key default gen_random_uuid(),species text not null,
 feed_id uuid references public.feeds(id),dog_feed_id uuid references public.dog_feeds(id),
 source_type text not null,source_name text not null,source_url text not null,
 source_pack_price_krw numeric not null check(source_pack_price_krw>0),
 source_pack_count integer not null check(source_pack_count>0),unit_weight_g numeric not null check(unit_weight_g>0),
 reference_method text not null,selection_basis text not null,availability_status text not null,
 reference_price_krw numeric generated always as (round(source_pack_price_krw/source_pack_count,2)) stored,
 price_per_100g_krw numeric generated always as (round(source_pack_price_krw/source_pack_count/unit_weight_g*100,2)) stored,
 verified_at timestamptz not null,last_checked_at timestamptz not null,updated_at timestamptz not null,created_at timestamptz not null
);
create unique index on public.food_reference_prices(feed_id) where feed_id is not null;
create unique index on public.food_reference_prices(dog_feed_id) where dog_feed_id is not null;
create table public.food_price_review_queue(id uuid primary key default gen_random_uuid(),species text,
 feed_id uuid,dog_feed_id uuid,status text,issue_type text,candidate_data jsonb);
grant select,insert on public.food_reference_prices to service_role;
grant select on public.food_price_review_queue to service_role;
