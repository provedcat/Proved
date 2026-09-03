-- Restrict medical-function condition search to Proved-approved veterinary/prescription diets.
-- General wellness foods (Urinary Care, Digestive Care, weight-control foods, etc.)
-- must not receive management_purpose tags used by the condition finder.

update public.food_tags
set
  label_ko = '동물병원 전용 처방식',
  label_en = 'Veterinary / prescription diet',
  description = '수의사의 진단을 바탕으로 처방되는 기능성 사료',
  updated_at = now()
where slug = 'veterinary_diet';

update public.food_tags
set
  description = case slug
    when 'urinary' then '동물병원 전용 처방식의 요로 기능'
    when 'renal' then '동물병원 전용 처방식의 신장 기능'
    when 'digestive' then '동물병원 전용 처방식의 소화기 기능'
    when 'skin_allergy' then '동물병원 전용 처방식의 피부·알레르기 기능'
    when 'weight_management' then '동물병원 전용 처방식의 체중관리 기능'
    when 'hepatic' then '동물병원 전용 처방식의 간 기능'
    when 'diabetes' then '동물병원 전용 처방식의 당뇨 기능'
    else description
  end,
  updated_at = now()
where category = 'management_purpose';

create or replace function public.is_supported_veterinary_diet(
  manufacturer text,
  product_name text
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $function$
  with normalized as (
    select
      lower(coalesce(manufacturer, '')) as m,
      lower(coalesce(product_name, '')) as p,
      lower(concat_ws(' ', manufacturer, product_name)) as identity_text
  )
  select
    (
      m ~ '(royal canin|로얄캐닌)'
      and (
        p ~ '(veterinary ?diet|베테리너리 ?다이어트|벳 ?다이어트)'
        or p ~ '(urinary ?s ?/ ?o|유리너리 ?s ?/ ?o|유러너리 ?s ?/ ?o|early ?renal|얼리 ?레날|(^|[^a-z])renal([^a-z]|$)|레날|gastro ?intestinal|가스트로 ?인테스티널|satiety|세타이어티|anallergenic|아날러제닉|hypoallergenic|하이포알러제닉|hepatic|헤파틱|diabetic|다이아베틱|recovery|리커버리|mobility|모빌리티|cardiac|카디악|sensitivity ?control|센시티비티 ?컨트롤)'
      )
    )
    or (m ~ '(hill''?s|힐스)' and p ~ '(prescription ?diet|프리 ?스크립션( ?다이어트)?|프레스크립션( ?다이어트)?)')
    or (m ~ '(purina|퓨리나)' and p ~ '(pro ?plan.*veterinary ?diets?|프로 ?플랜.*베테리너리 ?다이어트)')
    or (m ~ '(farmina|파미나)' and p ~ '(vet ?life|벳 ?라이프)')
    or identity_text ~ '(velixer|벨릭서)'
    or identity_text ~ '(dr[.]? ?healmedix|닥터 ?힐메딕스)'
    or identity_text ~ '(^|[^a-z])specific([^a-z]|$)|스페시픽'
    or (identity_text ~ '(forza ?10|포르자 ?10)' and p ~ '(^|[^a-z])(active|diet)([^a-z]|$)|액티브|다이어트')
    or (
      identity_text ~ '(alleva|알레바)'
      and p ~ '(gastro|renal|hepatic|urinary|intestinal|hypoallerg|diabet|obesity|derma|가스트로|레날|헤파틱|유리너리|하이포|다이아베틱|오베시티|더마)'
    )
    or identity_text ~ '(^|[^a-z0-9])v[.]?o[.]?m([^a-z0-9]|$)|브이오엠|봄 ?사료'
    or identity_text ~ '(eminent ?diet|에미넌트 ?다이어트)'
    or (identity_text ~ '(monge|몬지)' and p ~ '(vetsolution|vet ?solution|벳 ?솔루션|벳솔루션)')
  from normalized;
$function$;

create or replace function public.veterinary_function_slugs(
  manufacturer text,
  product_name text
)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $function$
  with normalized as (
    select lower(concat_ws(' ', manufacturer, product_name)) as x
  )
  select array_remove(array[
    case when x ~ '(urinary|유리너리|유러너리|비뇨|요로|struvite|스트루바이트|s ?/ ?o|(^|[^a-z0-9])c ?/ ?d([^a-z0-9]|$)|(^|[^a-z0-9])ur([^a-z0-9]|$))' then 'urinary' end,
    case when x ~ '(renal|kidney|레날|신장|(^|[^a-z0-9])k ?/ ?d([^a-z0-9]|$)|(^|[^a-z0-9])nf([^a-z0-9]|$))' then 'renal' end,
    case when x ~ '(digestive|gastro|intestinal|다이제스티브|가스트로|인테스티날|인테스티널|소화|gi ?biome|gi ?바이옴|(^|[^a-z0-9])i ?/ ?d([^a-z0-9]|$)|(^|[^a-z0-9])en([^a-z0-9]|$))' then 'digestive' end,
    case when x ~ '(skin|derma|allerg|hypoallerg|anallergenic|피부|더마|알레르|하이포알러|아날러제닉|(^|[^a-z0-9])z ?/ ?d([^a-z0-9]|$)|(^|[^a-z0-9])ha([^a-z0-9]|$))' then 'skin_allergy' end,
    case when x ~ '(weight|obesity|metabolic|satiety|웨이트|체중|비만|오베시티|메타볼릭|세타이어티|(^|[^a-z0-9])om([^a-z0-9]|$))' then 'weight_management' end,
    case when x ~ '(hepatic|헤파틱|liver (care|health|support|disease|diet|function)|간 ?(건강|질환|케어|관리|기능|보조)|(^|[^a-z0-9])l ?/ ?d([^a-z0-9]|$)|(^|[^a-z0-9])hp([^a-z0-9]|$))' then 'hepatic' end,
    case when x ~ '(diabet(es|ic)|당뇨|다이아베틱|(^|[^a-z0-9])dm([^a-z0-9]|$))' then 'diabetes' end
  ], null)
  from normalized;
$function$;

create or replace function public.sync_veterinary_function_tags_for_product(
  p_species text,
  p_product_id uuid,
  p_manufacturer text,
  p_product_name text
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
  supported boolean;
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

  supported := public.is_supported_veterinary_diet(p_manufacturer, p_product_name);

  if supported then
    execute format(
      'delete from public.%I mapping
       using public.food_tags tag
       where mapping.tag_id = tag.id
         and mapping.%I = $1
         and (tag.category = ''management_purpose'' or tag.slug = ''veterinary_diet'')
         and mapping.source <> ''manual''',
      join_table,
      id_column
    ) using p_product_id;
  else
    execute format(
      'delete from public.%I mapping
       using public.food_tags tag
       where mapping.tag_id = tag.id
         and mapping.%I = $1
         and (tag.category = ''management_purpose'' or tag.slug = ''veterinary_diet'')',
      join_table,
      id_column
    ) using p_product_id;
    return;
  end if;

  execute format(
    'insert into public.%I (%I, tag_id, source, confidence, reason)
     select $1, id, ''manufacturer_claim'', ''high'', $2
     from public.food_tags
     where slug = ''veterinary_diet'' and is_active
     on conflict do nothing',
    join_table,
    id_column
  ) using p_product_id, 'Proved 지정 동물병원 전용 처방식 브랜드·라인';

  foreach tag_slug in array public.veterinary_function_slugs(p_manufacturer, p_product_name) loop
    execute format(
      'insert into public.%I (%I, tag_id, source, confidence, reason)
       select $1, id, ''manufacturer_claim'', ''high'', $2
       from public.food_tags
       where slug = $3 and category = ''management_purpose'' and is_active
       on conflict do nothing',
      join_table,
      id_column
    ) using p_product_id, '동물병원 전용 처방식 제품명의 기능 분류', tag_slug;
  end loop;
end;
$function$;

create or replace function public.sync_veterinary_function_tags_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.sync_veterinary_function_tags_for_product(
    case when tg_table_name = 'feeds' then 'cat' else 'dog' end,
    new.id,
    new."제조사",
    new."제품명"
  );
  return new;
end;
$function$;

revoke all on function public.sync_veterinary_function_tags_for_product(text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.sync_veterinary_function_tags_row() from public, anon, authenticated;

-- Trigger name intentionally sorts after the broad auto-tag trigger so this policy is the final authority.
drop trigger if exists zzz_sync_veterinary_function_tags_feed on public.feeds;
create trigger zzz_sync_veterinary_function_tags_feed
after insert or update of "제조사", "제품명" on public.feeds
for each row execute function public.sync_veterinary_function_tags_row();

drop trigger if exists zzz_sync_veterinary_function_tags_dog_feed on public.dog_feeds;
create trigger zzz_sync_veterinary_function_tags_dog_feed
after insert or update of "제조사", "제품명" on public.dog_feeds
for each row execute function public.sync_veterinary_function_tags_row();

create or replace function public.backfill_veterinary_function_tags()
returns table(species text, tagged_products bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  r record;
begin
  for r in select id, "제조사", "제품명" from public.feeds loop
    perform public.sync_veterinary_function_tags_for_product('cat', r.id, r."제조사", r."제품명");
  end loop;

  for r in select id, "제조사", "제품명" from public.dog_feeds loop
    perform public.sync_veterinary_function_tags_for_product('dog', r.id, r."제조사", r."제품명");
  end loop;

  return query
    select 'cat'::text, count(distinct mapping.feed_id)::bigint
    from public.feed_food_tags mapping
    join public.food_tags tag on tag.id = mapping.tag_id
    where tag.slug = 'veterinary_diet'
    union all
    select 'dog'::text, count(distinct mapping.dog_feed_id)::bigint
    from public.dog_feed_food_tags mapping
    join public.food_tags tag on tag.id = mapping.tag_id
    where tag.slug = 'veterinary_diet';
end;
$function$;

revoke all on function public.backfill_veterinary_function_tags() from public, anon, authenticated;

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
end;
$function$;

-- Reconcile existing mappings immediately.
do $block$
begin
  perform public.backfill_veterinary_function_tags();
end;
$block$;
