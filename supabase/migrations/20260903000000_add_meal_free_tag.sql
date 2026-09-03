insert into public.food_tags (
  slug,
  label_ko,
  label_en,
  category,
  description,
  sort_order,
  is_active
)
values (
  'meal_free',
  '無육분',
  'Meal-free',
  'ingredient_condition',
  '렌더링 육분을 사용하지 않은 제품. 습식·동결건조는 공개 전성분으로 판정하며, 건사료는 제조사의 육분 미사용 claim이 확인된 제품군만 포함',
  5,
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

create or replace function public.is_meal_free_feed(
  feed_type text,
  manufacturer text,
  product_name text,
  ingredients text,
  is_freeze_dried boolean default false
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $function$
  with normalized as (
    select
      lower(coalesce(feed_type, '')) as kind,
      lower(concat_ws(' ', manufacturer, product_name)) as identity_text,
      lower(coalesce(product_name, '')) as name_text,
      lower(coalesce(ingredients, '')) as ingredient_text
  ), flags as (
    select
      *,
      length(trim(ingredient_text)) >= 10
        and ingredient_text !~ '(정보 ?없음|확인 ?필요|미공개|미상)' as has_ingredients,
      identity_text ~ '(rawz|로우즈|로우스)'
        and name_text ~ '(meal[ -]?free|밀 ?프리)'
        and name_text ~ '(dry|드라이)' as rawz_meal_free_claim,
      ingredient_text ~ '(육분|어분|계육분|육골분|골육분|meat[ -]?meal|poultry[ -]?meal|chicken[ -]?meal|turkey[ -]?meal|duck[ -]?meal|beef[ -]?meal|lamb[ -]?meal|pork[ -]?meal|rabbit[ -]?meal|venison[ -]?meal|fish[ -]?meal|salmon[ -]?meal|herring[ -]?meal|건조육|건어|동물성 ?단백질 ?분말|어류 ?분말|해양어류분말|(dehydrat(e|ed)|dried)[ -]?(chicken|turkey|duck|beef|lamb|pork|rabbit|venison|salmon|fish|herring|mackerel|sardine|cod|pollock|meat|poultry|egg|animal))' as rendered_marker
    from normalized
  )
  select has_ingredients and (
    rawz_meal_free_claim
    or (
      not rendered_marker
      and (
        kind = 'wet'
        or coalesce(is_freeze_dried, false)
        or (kind = 'dry' and identity_text ~ '(platinum|플래티넘).*(meat ?crisp|미트 ?크리스프)')
        or (kind = 'dry' and identity_text ~ '(leonardo|레오나르도).*순수 ?생육')
      )
    )
  )
  from flags;
$function$;

revoke all on function public.is_meal_free_feed(text,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.is_meal_free_feed(text,text,text,text,boolean) to service_role;

create or replace function public.sync_meal_free_feed_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  join_table text;
  id_column text;
  freeze_dried boolean;
begin
  if tg_table_name = 'feeds' then
    join_table := 'feed_food_tags';
    id_column := 'feed_id';
  elsif tg_table_name = 'dog_feeds' then
    join_table := 'dog_feed_food_tags';
    id_column := 'dog_feed_id';
  else
    raise exception 'sync_meal_free_feed_row: unsupported table %', tg_table_name;
  end if;

  execute format(
    'select exists (
       select 1
       from public.%I mapping
       join public.food_tags tag on tag.id = mapping.tag_id
       where mapping.%I = $1 and tag.slug = ''freeze_dried''
     )',
    join_table,
    id_column
  ) into freeze_dried using new.id;

  execute format(
    'delete from public.%I mapping
     using public.food_tags tag
     where mapping.tag_id = tag.id
       and mapping.%I = $1
       and tag.slug = ''meal_free''
       and mapping.source <> ''manual''',
    join_table,
    id_column
  ) using new.id;

  if public.is_meal_free_feed(
    new.type,
    new."제조사",
    new."제품명",
    new."전성분",
    freeze_dried
  ) then
    execute format(
      'insert into public.%I (%I, tag_id, source, confidence, reason)
       select $1, id, $2, ''high'', $3
       from public.food_tags
       where slug = ''meal_free'' and is_active
       on conflict do nothing',
      join_table,
      id_column
    ) using new.id,
      case
        when new.type = 'dry' then 'manufacturer_claim'
        else 'ingredient_derived'
      end,
      case
        when lower(coalesce(new."제품명", '')) ~ '(meal[ -]?free|밀 ?프리)'
          then '제조사가 제품명에서 Meal-free를 명시한 RAWZ 건사료'
        when new.type = 'wet'
          then '공개 전성분에 렌더링 육분 또는 건조·탈수 동물성 원료가 없음'
        when freeze_dried
          then '동결건조 제품이며 공개 전성분에 렌더링 육분이 없음'
        else '제조사가 순수생육 또는 육분 미사용을 강조한 건사료 제품군'
      end;
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_meal_free_feed_row() from public, anon, authenticated;

drop trigger if exists zz_sync_meal_free_feed_row on public.feeds;
create trigger zz_sync_meal_free_feed_row
after insert or update
on public.feeds
for each row execute function public.sync_meal_free_feed_row();

drop trigger if exists zz_sync_meal_free_dog_feed_row on public.dog_feeds;
create trigger zz_sync_meal_free_dog_feed_row
after insert or update
on public.dog_feeds
for each row execute function public.sync_meal_free_feed_row();

create or replace function public.backfill_meal_free_tags()
returns table(species text, tagged_products bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  meal_free_tag_id bigint;
begin
  select id into meal_free_tag_id
  from public.food_tags
  where slug = 'meal_free' and is_active;

  if meal_free_tag_id is null then
    raise exception 'meal_free tag is missing or inactive';
  end if;

  delete from public.feed_food_tags
  where tag_id = meal_free_tag_id and source <> 'manual';
  delete from public.dog_feed_food_tags
  where tag_id = meal_free_tag_id and source <> 'manual';

  insert into public.feed_food_tags (feed_id, tag_id, source, confidence, reason)
  select
    feed.id,
    meal_free_tag_id,
    case
      when feed.type = 'dry' then 'manufacturer_claim'
      else 'ingredient_derived'
    end,
    'high',
    case
      when lower(coalesce(feed."제품명", '')) ~ '(meal[ -]?free|밀 ?프리)'
        then '제조사가 제품명에서 Meal-free를 명시한 RAWZ 건사료'
      when feed.type = 'wet'
        then '공개 전성분에 렌더링 육분 또는 건조·탈수 동물성 원료가 없음'
      when processing.freeze_dried
        then '동결건조 제품이며 공개 전성분에 렌더링 육분이 없음'
      else '제조사가 순수생육 또는 육분 미사용을 강조한 건사료 제품군'
    end
  from public.feeds feed
  cross join lateral (
    select exists (
      select 1
      from public.feed_food_tags mapping
      join public.food_tags tag on tag.id = mapping.tag_id
      where mapping.feed_id = feed.id and tag.slug = 'freeze_dried'
    ) as freeze_dried
  ) processing
  where public.is_meal_free_feed(
    feed.type, feed."제조사", feed."제품명", feed."전성분", processing.freeze_dried
  )
  on conflict do nothing;

  insert into public.dog_feed_food_tags (dog_feed_id, tag_id, source, confidence, reason)
  select
    feed.id,
    meal_free_tag_id,
    case
      when feed.type = 'dry' then 'manufacturer_claim'
      else 'ingredient_derived'
    end,
    'high',
    case
      when lower(coalesce(feed."제품명", '')) ~ '(meal[ -]?free|밀 ?프리)'
        then '제조사가 제품명에서 Meal-free를 명시한 RAWZ 건사료'
      when feed.type = 'wet'
        then '공개 전성분에 렌더링 육분 또는 건조·탈수 동물성 원료가 없음'
      when processing.freeze_dried
        then '동결건조 제품이며 공개 전성분에 렌더링 육분이 없음'
      else '제조사가 순수생육 또는 육분 미사용을 강조한 건사료 제품군'
    end
  from public.dog_feeds feed
  cross join lateral (
    select exists (
      select 1
      from public.dog_feed_food_tags mapping
      join public.food_tags tag on tag.id = mapping.tag_id
      where mapping.dog_feed_id = feed.id and tag.slug = 'freeze_dried'
    ) as freeze_dried
  ) processing
  where public.is_meal_free_feed(
    feed.type, feed."제조사", feed."제품명", feed."전성분", processing.freeze_dried
  )
  on conflict do nothing;

  return query
  select 'cat'::text, count(*)
  from public.feed_food_tags where tag_id = meal_free_tag_id
  union all
  select 'dog'::text, count(*)
  from public.dog_feed_food_tags where tag_id = meal_free_tag_id;
end;
$function$;

revoke all on function public.backfill_meal_free_tags() from public, anon, authenticated;
grant execute on function public.backfill_meal_free_tags() to service_role;

alter function public.backfill_food_tags() rename to backfill_food_tags_core;
revoke all on function public.backfill_food_tags_core() from public, anon, authenticated;
grant execute on function public.backfill_food_tags_core() to service_role;

create function public.backfill_food_tags()
returns table(species text, products bigint, tagged_products bigint, untagged_products bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  return query select * from public.backfill_food_tags_core();
  perform public.backfill_meal_free_tags();
end;
$function$;

revoke all on function public.backfill_food_tags() from public, anon, authenticated;
grant execute on function public.backfill_food_tags() to service_role;

select * from public.backfill_meal_free_tags();
