-- Correct processing-method tags after manual product review.
-- 1) RAWZ Meal Free dry cat foods are extruded finished products; "dehydrated"
--    in the product name describes an ingredient, not the finished-food process.
-- 2) Oven-baked is not auto-assigned to wet foods. A manually verified wet-food
--    oven-baked tag can still be kept with source='manual'.

update public.food_tags
set label_ko = '익스트루전'
where slug = 'extruded';

create or replace function public.sync_processing_method_tag_overrides_for_product(
  p_species text,
  p_product_id uuid,
  p_type text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  join_table text;
  id_column text;
begin
  if p_species = 'cat' then
    join_table := 'feed_food_tags';
    id_column := 'feed_id';
  elsif p_species = 'dog' then
    join_table := 'dog_feed_food_tags';
    id_column := 'dog_feed_id';
  else
    raise exception 'unsupported species: %', p_species;
  end if;

  -- A manually verified processing-method tag is authoritative for the product.
  -- Keep manual tags and remove any conflicting auto-derived processing tags.
  execute format(
    'delete from public.%I x
       using public.food_tags t
       where x.%I = $1
         and x.tag_id = t.id
         and x.source <> ''manual''
         and t.category = ''processing_method''
         and (
           exists (
             select 1
             from public.%I m
             join public.food_tags mt on mt.id = m.tag_id
             where m.%I = $1
               and m.source = ''manual''
               and mt.category = ''processing_method''
           )
           or (
             lower(coalesce($2, '''')) = ''wet''
             and t.slug = ''oven_baked''
           )
         )',
    join_table,
    id_column,
    join_table,
    id_column
  )
  using p_product_id, p_type;
end;
$$;

create or replace function public.sync_processing_method_tag_overrides_row()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_table_name = 'feeds' then
    perform public.sync_processing_method_tag_overrides_for_product(
      'cat', new.id, new.type
    );
  elsif tg_table_name = 'dog_feeds' then
    perform public.sync_processing_method_tag_overrides_for_product(
      'dog', new.id, new.type
    );
  end if;

  return new;
end;
$$;

drop trigger if exists zzzzz_sync_processing_method_overrides_feed on public.feeds;
create trigger zzzzz_sync_processing_method_overrides_feed
after insert or update on public.feeds
for each row execute function public.sync_processing_method_tag_overrides_row();

drop trigger if exists zzzzz_sync_processing_method_overrides_dog_feed on public.dog_feeds;
create trigger zzzzz_sync_processing_method_overrides_dog_feed
after insert or update on public.dog_feeds
for each row execute function public.sync_processing_method_tag_overrides_row();

create or replace function public.backfill_processing_method_tag_overrides()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
begin
  for r in select id, type from public.feeds loop
    perform public.sync_processing_method_tag_overrides_for_product('cat', r.id, r.type);
  end loop;

  for r in select id, type from public.dog_feeds loop
    perform public.sync_processing_method_tag_overrides_for_product('dog', r.id, r.type);
  end loop;
end;
$$;

-- Manual review: RAWZ Meal Free Dry Food for Cats (two registered recipes)
-- uses extrusion for the finished kibble. Preserve this manual processing tag.
insert into public.feed_food_tags (feed_id, tag_id, source, confidence, reason)
select
  f.id,
  t.id,
  'manual',
  'high',
  '수동 검수: 완제품 제조 방식은 익스트루전(압출). 제품명의 Dehydrated는 원료 상태 표현'
from public.feeds f
join public.food_tags t on t.slug = 'extruded' and t.is_active
where f.type = 'dry'
  and lower(coalesce(f."제조사", '')) = 'rawz'
  and (
    f."제품명" ilike '%Dehydrated Chicken,Turkey & Chicken Recipe%'
    or f."제품명" ilike '%Salmon, Dehydrated Chicken & Whitefish Recipe%'
  )
on conflict (feed_id, tag_id)
do update set
  source = excluded.source,
  confidence = excluded.confidence,
  reason = excluded.reason;

-- Apply the guardrails immediately:
-- - removes the RAWZ auto-derived dehydrated tags because a manual processing
--   method now exists;
-- - removes auto-derived oven_baked from wet foods, including the reviewed Monge item.
select public.backfill_processing_method_tag_overrides();

-- Keep the shared tag backfill durable: after broad auto-tagging and specialized
-- wet/veterinary backfills, re-apply processing-method manual overrides.
create or replace function public.backfill_food_tags()
returns table(species text, products bigint, tagged_products bigint, untagged_products bigint)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  return query select * from public.backfill_food_tags_core();
  perform public.backfill_meal_free_tags();
  perform public.backfill_veterinary_function_tags();
  perform 1 from public.backfill_wet_thickener_tags();
  perform public.backfill_processing_method_tag_overrides();
end;
$$;

revoke all on function public.sync_processing_method_tag_overrides_for_product(text, uuid, text)
from public, anon, authenticated;
revoke all on function public.sync_processing_method_tag_overrides_row()
from public, anon, authenticated;
revoke all on function public.backfill_processing_method_tag_overrides()
from public, anon, authenticated;

grant execute on function public.sync_processing_method_tag_overrides_for_product(text, uuid, text)
to service_role;
grant execute on function public.sync_processing_method_tag_overrides_row()
to service_role;
grant execute on function public.backfill_processing_method_tag_overrides()
to service_role;
