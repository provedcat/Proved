-- Cover spaced Korean dried/dehydrated animal ingredient names that the
-- initial matcher did not recognize. Explicit reviewed exceptions still win.

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
      identity_text ~ '(정글키친).*동결건조.*오션 ?피쉬' as whole_dried_fish_exception,
      ingredient_text ~ '(육분|어분|계육분|육골분|골육분|meat[ -]?meal|poultry[ -]?meal|chicken[ -]?meal|turkey[ -]?meal|duck[ -]?meal|beef[ -]?meal|lamb[ -]?meal|pork[ -]?meal|rabbit[ -]?meal|venison[ -]?meal|fish[ -]?meal|salmon[ -]?meal|herring[ -]?meal|건조육|건어|동물성 ?단백질 ?분말|어류 ?분말|해양어류분말|((건조|탈수|탈수건조)[[:space:]]*(닭고기|칠면조고기|오리고기|쇠고기|소고기|양고기|돼지고기|토끼고기|사슴고기|연어|청어|고등어|정어리|대구|명태|생선|어류|가금류|육류|동물성[[:space:]]*단백질))|((닭고기|칠면조고기|오리고기|쇠고기|소고기|양고기|돼지고기|토끼고기|사슴고기|연어|청어|고등어|정어리|대구|명태|생선|어류|가금류|육류)[[:space:]]*(분말|건조분))|(dehydrat(e|ed)|dried)[ -]?(chicken|turkey|duck|beef|lamb|pork|rabbit|venison|salmon|fish|herring|mackerel|sardine|cod|pollock|meat|poultry|animal))' as rendered_marker
    from normalized
  )
  select has_ingredients and (
    rawz_meal_free_claim
    or (whole_dried_fish_exception and coalesce(is_freeze_dried, false))
    or (
      not rendered_marker
      and (
        kind = 'wet'
        or coalesce(is_freeze_dried, false)
        or (kind = 'dry' and identity_text ~ '(platinum|플래티넘).*(meat ?crisp|미트 ?크리스프)')
        or (kind = 'dry' and identity_text ~ '(leonardo|레오나르도).*순수 ?생육')
        or (kind = 'dry' and identity_text ~ '(carna ?4|카르나 ?4)')
      )
    )
  )
  from flags;
$function$;

select * from public.backfill_meal_free_tags();
