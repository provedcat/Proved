create table if not exists public.calculation_events (
  id uuid primary key default gen_random_uuid(),
  anonymous_session_id uuid not null,
  species text not null check (species in ('cat', 'dog')),
  weight_kg numeric not null check (weight_kg >= 0.5 and weight_kg <= 150),
  age_months numeric not null check (age_months >= 0 and age_months <= 480),
  is_neutered boolean not null,
  is_diet boolean not null default false,
  is_pregnant boolean not null default false,
  is_lactating boolean not null default false,
  dog_activity text check (dog_activity is null or dog_activity in ('low', 'normal', 'high')),
  expected_adult_weight_kg numeric check (
    expected_adult_weight_kg is null
    or (expected_adult_weight_kg >= 1 and expected_adult_weight_kg <= 150)
  ),
  dry_feed_ids uuid[] not null default '{}',
  wet_feed_ids uuid[] not null default '{}',
  dry_ratio_pct smallint not null check (dry_ratio_pct between 0 and 100),
  wet_ratio_pct smallint not null check (wet_ratio_pct between 0 and 100),
  treat_kcal numeric not null default 0 check (treat_kcal >= 0),
  der_kcal numeric not null check (der_kcal > 0),
  food_kcal numeric not null check (food_kcal >= 0),
  feed_amounts jsonb not null default '[]'::jsonb check (jsonb_typeof(feed_amounts) = 'array'),
  calculated_at timestamptz not null default now(),
  is_logged_in boolean not null default false,
  user_id uuid references auth.users(id) on delete set null,
  constraint calculation_events_ratio_total_check check (dry_ratio_pct + wet_ratio_pct = 100),
  constraint calculation_events_cat_dog_fields_check check (
    species = 'dog'
    or (dog_activity is null and expected_adult_weight_kg is null)
  )
);

alter table public.calculation_events enable row level security;

revoke all on table public.calculation_events from anon, authenticated;
grant insert on table public.calculation_events to anon, authenticated;

drop policy if exists "Anonymous users can insert calculation events" on public.calculation_events;
create policy "Anonymous users can insert calculation events"
on public.calculation_events
for insert
to anon
with check (
  is_logged_in = false
  and user_id is null
);

drop policy if exists "Authenticated users can insert own calculation events" on public.calculation_events;
create policy "Authenticated users can insert own calculation events"
on public.calculation_events
for insert
to authenticated
with check (
  is_logged_in = true
  and user_id = (select auth.uid())
);
