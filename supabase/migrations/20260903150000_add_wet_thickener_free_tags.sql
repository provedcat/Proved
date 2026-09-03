-- Add nested wet-food ingredient-condition tags based on the published ingredient list.
-- Inclusion is intentionally hierarchical:
-- thickener_free => gum_agar_free => carrageenan_free.

insert into public.food_tags (
  slug,
  label_ko,
  label_en,
  category,
  description,
  sort_order,
  is_active
)
values
  (
    'carrageenan_free',
    '카라기난 프리',
    'Carrageenan-free',
    'ingredient_condition',
    '공개 전성분에서 카라기난이 확인되지 않은 습식사료',
    50,
    true
  ),
  (
    'gum_agar_free',
    '검류·한천 프리',
    'Gum & agar-free',
    'ingredient_condition',
    '카라기난을 포함한 검류·한천이 공개 전성분에서 확인되지 않은 습식사료',
    60,
    true
  ),
  (
    'thickener_free',
    '무점증제',
    'Thickener-free',
    'ingredient_condition',
    '카라기난·검류·한천·알긴산계·셀룰로오스검·전분계 및 명시적 점증·결착 성분이 공개 전성분에서 확인되지 않은 습식사료',
    70,
    true
  )
on conflict (slug) do update set
  label_ko = excluded.label_ko,
  label_en = excluded.label_en,
  category = excluded.category,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

create or replace function public.wet_thickener_free_slugs(
  feed_type text,
  ingredients text
)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $function$
  with normalized as (
    select
      lower(coalesce(feed_type, '')) as kind,
      lower(coalesce(ingredients, '')) as ingredient_text
  ), flags as (
    select
      *,
      length(trim(ingredient_text)) >= 4
        and ingredient_text !~ '(정보 ?없음|확인 ?필요|미공개|미상)' as has_ingredients,
      ingredient_text ~ '(carrageenan|carrageen|카라기난)' as has_carrageenan,
      ingredient_text ~ '((^|[^a-z])gum([^a-z]|$)|guar ?gum|xanthan(?: ?gum)?|locust ?bean ?gum|carob ?(?:bean ?)?gum|cassia ?gum|tara ?gum|gellan ?gum|gum ?arabic|acacia ?gum|konjac ?gum|glucomannan|agar(?:-agar)?|구아 ?검|잔탄(?: ?검)?|산탄 ?검|로커스트 ?(?:빈|콩) ?검|캐롭 ?(?:빈)? ?검|카시아 ?검|계피 ?검|타라 ?검|젤란 ?검|아라비아 ?검|아카시아 ?검|곤약 ?검|글루코만난|한천|증점 ?다당류|점증제|증점제|증점 ?안정제|겔화제|thickener|gelling ?agent)' as has_gum_or_agar,
      ingredient_text ~ '(alginate|alginic ?acid|sodium ?alginate|알긴산|알긴산 ?나트륨|cellulose ?gum|carboxymethyl ?cellulose|carboxy ?methyl ?cellulose|(^|[^a-z])cmc([^a-z]|$)|methylcellulose|hydroxypropyl ?methylcellulose|셀룰로오스 ?검|카복시메틸 ?셀룰로오스|카르복시메틸 ?셀룰로오스|메틸 ?셀룰로오스|starch|전분|tapioca|타피오카|pectin|펙틴|gelatin|gelatine|젤라틴|결착제|binding ?agent)' as has_other_thickener
    from normalized
  )
  select case
    when kind <> 'wet' or not has_ingredients then array[]::text[]
    else array_remove(array[
      case when not has_carrageenan then 'carrageenan_free' end,
      case when not has_carrageenan and not has_gum_or_agar then 'gum_agar_free' end,
      case when not has_carrageenan and not has_gum_or_agar and not has_other_thickener then 'thickener_free' end
    ], null)
  end
  from flags;
$function$;

revoke all on function public.wet_thickener_free_slugs(text,text) from public, anon, authenticated;
grant execute on function public.wet_thickener_free_slugs(text,text) to service_role;

create or replace function public.sync_wet_thickener_tags_for_product(
  p_species text,
  p_product_id uuid,
  p_feed_type text,
  p_ingredients text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  join_table text;
  id_column text;
  tag_slug text;
  tag_reason text;
begin
  if p_species = 'cat' then
    join_table := 'feed_food_tags';
    id_column := 'feed_id';
  elsif p_species = 'dog' then
    join_table := 'dog_feed_food_tags';
    id_column := 'dog_feed_id';
  else
    raise exception 'Unsupported species: %', p_species;
  end if;

  execute format(
    'delete from public.%I mapping
     using public.food_tags tag
     where mapping.tag_id = tag.id
       and mapping.%I = $1
       and tag.slug in (''carrageenan_free'', ''gum_agar_free'', ''thickener_free'')
       and mapping.source <> ''manual''',
    join_table,
    id_column
  ) using p_product_id;

  foreach tag_slug in array public.wet_thickener_free_slugs(p_feed_type, p_ingredients) loop
    tag_reason := case tag_slug
      when 'carrageenan_free' then '공개 전성분에서 카라기난이 확인되지 않음'
      when 'gum_agar_free' then '공개 전성분에서 카라기난·검류·한천이 확인되지 않음'
      when 'thickener_free' then '공개 전성분에서 지정 점증·겔화·결착 성분이 확인되지 않음'
    end;

    execute format(
      'insert into public.%I (%I, tag_id, source, confidence, reason)
       select $1, id, ''ingredient_derived'', ''high'', $2
       from public.food_tags
       where slug = $3 and category = ''ingredient_condition'' and is_active
       on conflict do nothing',
      join_table,
      id_column
    ) using p_product_id, tag_reason, tag_slug;
  end loop;
end;
$function$;

revoke all on function public.sync_wet_thickener_tags_for_product(text,uuid,text,text) from public, anon, authenticated;

create or replace function public.sync_wet_thickener_tags_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.sync_wet_thickener_tags_for_product(
    case when tg_table_name = 'feeds' then 'cat' else 'dog' end,
    new.id,
    new.type,
    new."전성분"
  );
  return new;
end;
$function$;

revoke all on function public.sync_wet_thickener_tags_row() from public, anon, authenticated;

-- The broad auto-tag trigger deletes non-manual mappings on relevant updates.
-- This trigger name sorts after it and runs on every row update so these derived tags are restored/re-evaluated.
drop trigger if exists zzzz_sync_wet_thickener_tags_feed on public.feeds;
create trigger zzzz_sync_wet_thickener_tags_feed
after insert or update on public.feeds
for each row execute function public.sync_wet_thickener_tags_row();

drop trigger if exists zzzz_sync_wet_thickener_tags_dog_feed on public.dog_feeds;
create trigger zzzz_sync_wet_thickener_tags_dog_feed
after insert or update on public.dog_feeds
for each row execute function public.sync_wet_thickener_tags_row();

create or replace function public.backfill_wet_thickener_tags()
returns table(
  species text,
  carrageenan_free bigint,
  gum_agar_free bigint,
  thickener_free bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  r record;
begin
  for r in select id, type, "전성분" from public.feeds loop
    perform public.sync_wet_thickener_tags_for_product('cat', r.id, r.type, r."전성분");
  end loop;

  for r in select id, type, "전성분" from public.dog_feeds loop
    perform public.sync_wet_thickener_tags_for_product('dog', r.id, r.type, r."전성분");
  end loop;

  return query
    select
      'cat'::text,
      count(distinct mapping.feed_id) filter (where tag.slug = 'carrageenan_free')::bigint,
      count(distinct mapping.feed_id) filter (where tag.slug = 'gum_agar_free')::bigint,
      count(distinct mapping.feed_id) filter (where tag.slug = 'thickener_free')::bigint
    from public.feed_food_tags mapping
    join public.food_tags tag on tag.id = mapping.tag_id
    where tag.slug in ('carrageenan_free', 'gum_agar_free', 'thickener_free')
    union all
    select
      'dog'::text,
      count(distinct mapping.dog_feed_id) filter (where tag.slug = 'carrageenan_free')::bigint,
      count(distinct mapping.dog_feed_id) filter (where tag.slug = 'gum_agar_free')::bigint,
      count(distinct mapping.dog_feed_id) filter (where tag.slug = 'thickener_free')::bigint
    from public.dog_feed_food_tags mapping
    join public.food_tags tag on tag.id = mapping.tag_id
    where tag.slug in ('carrageenan_free', 'gum_agar_free', 'thickener_free');
end;
$function$;

revoke all on function public.backfill_wet_thickener_tags() from public, anon, authenticated;
grant execute on function public.backfill_wet_thickener_tags() to service_role;

-- Keep the shared backfill entry point complete when it is run later.
create or replace function public.backfill_food_tags()
returns table(species text, products bigint, tagged_products bigint, untagged_products bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  return query select * from public.backfill_food_tags_core();
  perform public.backfill_meal_free_tags();
  perform public.backfill_veterinary_function_tags();
  perform 1 from public.backfill_wet_thickener_tags();
end;
$function$;

revoke all on function public.backfill_food_tags() from public, anon, authenticated;
grant execute on function public.backfill_food_tags() to service_role;

-- Reconcile existing products immediately.
do $block$
begin
  perform 1 from public.backfill_wet_thickener_tags();
end;
$block$;
