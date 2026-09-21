-- Add dog processing tags and expand protein-source taxonomy.
-- UI ordering is driven by food_tags.sort_order.

insert into public.food_tags (slug,label_ko,label_en,category,description,sort_order,is_active)
values
  ('soft_semi_moist','소프트·반습식','Soft / semi-moist','processing_method','알갱이형 소프트·반습식 사료. Proved에서는 dry의 하위 제형으로 분류',1,true),
  ('fresh_cooked','화식','Fresh cooked','processing_method','가열 조리 후 냉장·냉동 유통되는 고수분 조리식. 생식은 제외',2,true)
on conflict (slug) do update set
  label_ko=excluded.label_ko,
  label_en=excluded.label_en,
  category=excluded.category,
  description=excluded.description,
  sort_order=excluded.sort_order,
  is_active=excluded.is_active,
  updated_at=now();

-- Common proteins first, seafood second, novel/special proteins last.
update public.food_tags set sort_order = v.sort_order
from (values
  ('chicken',10),('turkey',20),('duck',30),('beef',40),('lamb',50),('pork',60),('egg',70),
  ('salmon',100),('tuna',110),('white_fish',120),('fish',130),('cod',140),('pollock',150),
  ('trout',160),('herring',170),('mackerel',180),('sardine',190),('anchovy',200),
  ('insect',400),('horse',410),('wild_boar',420),('quail',430),('bison',440),
  ('venison',450),('goat',460),('kangaroo',480),('rabbit',490)
) as v(slug,sort_order)
where public.food_tags.slug=v.slug and public.food_tags.category='protein_source';

insert into public.food_tags (slug,label_ko,label_en,category,description,sort_order,is_active)
values
  ('goose','거위','Goose','protein_source','거위 유래 단백질원',80,true),
  ('bonito','가다랑어','Bonito','protein_source','가다랑어 유래 단백질원',210,true),
  ('hoki','호키','Hoki','protein_source','호키 유래 단백질원',220,true),
  ('bass','농어','Bass','protein_source','농어 유래 단백질원',230,true),
  ('sea_bream','도미류','Sea bream','protein_source','도미·실꼬리돔 등 도미류 단백질원',240,true),
  ('flatfish','가자미·광어','Flatfish','protein_source','가자미·광어류 단백질원',250,true),
  ('tilapia','틸라피아','Tilapia','protein_source','틸라피아 유래 단백질원',260,true),
  ('rockfish','볼락','Rockfish','protein_source','볼락 유래 단백질원',270,true),
  ('shrimp','새우','Shrimp','protein_source','새우 유래 단백질원',280,true),
  ('krill','크릴','Krill','protein_source','크릴 유래 단백질원',290,true),
  ('crab','게','Crab','protein_source','게 유래 단백질원',300,true),
  ('lobster','바닷가재','Lobster','protein_source','바닷가재 유래 단백질원',310,true),
  ('squid','오징어','Squid','protein_source','오징어 유래 단백질원',320,true),
  ('octopus','문어','Octopus','protein_source','문어 유래 단백질원',330,true),
  ('mussel','홍합','Mussel','protein_source','홍합 유래 단백질원',340,true),
  ('shellfish','조개류','Shellfish','protein_source','조개·가리비·전복 등 패류 단백질원',350,true),
  ('wallaby','왈라비','Wallaby','protein_source','왈라비 유래 특수 단백질원',470,true)
on conflict (slug) do update set
  label_ko=excluded.label_ko,
  label_en=excluded.label_en,
  category=excluded.category,
  description=excluded.description,
  sort_order=excluded.sort_order,
  is_active=excluded.is_active,
  updated_at=now();

create or replace function public.sync_extended_protein_tags_for_product(
  p_species text,
  p_product_id uuid,
  p_protein text
)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  join_table text;
  id_column text;
  protein text := lower(coalesce(p_protein,''));
  tag_slug text;
  specific_seafood boolean := false;
begin
  if p_species='cat' then
    join_table := 'feed_food_tags'; id_column := 'feed_id';
  elsif p_species='dog' then
    join_table := 'dog_feed_food_tags'; id_column := 'dog_feed_id';
  else
    raise exception 'unsupported species: %', p_species;
  end if;

  execute format(
    'delete from public.%I x using public.food_tags t
      where x.%I=$1 and x.tag_id=t.id and x.source<>''manual''
        and t.slug = any($2)',
    join_table,id_column
  )
  using p_product_id, array[
    'goose','bonito','hoki','bass','sea_bream','flatfish','tilapia','rockfish',
    'shrimp','krill','crab','lobster','squid','octopus','mussel','shellfish','wallaby'
  ];

  foreach tag_slug in array array[
    'goose','bonito','hoki','bass','sea_bream','flatfish','tilapia','rockfish',
    'shrimp','krill','crab','lobster','squid','octopus','mussel','shellfish','wallaby'
  ] loop
    if (tag_slug='goose' and protein ~ '(goose|거위)')
       or (tag_slug='bonito' and protein ~ '(bonito|skipjack|가다랑어|가쓰오)')
       or (tag_slug='hoki' and protein ~ '(hoki|호키)')
       or (tag_slug='bass' and protein ~ '(sea ?bass|bass|농어)')
       or (tag_slug='sea_bream' and protein ~ '(sea ?bream|bream|도미|실꼬리돔|threadfin)')
       or (tag_slug='flatfish' and protein ~ '(flatfish|flounder|halibut|sole|가자미|광어)')
       or (tag_slug='tilapia' and protein ~ '(tilapia|틸라피아)')
       or (tag_slug='rockfish' and protein ~ '(rockfish|볼락)')
       or (tag_slug='shrimp' and protein ~ '(shrimp|prawn|새우)')
       or (tag_slug='krill' and protein ~ '(krill|크릴)')
       or (tag_slug='crab' and protein ~ '(^|[^a-z])(crab|게)([^a-z]|$)')
       or (tag_slug='lobster' and protein ~ '(lobster|바닷가재)')
       or (tag_slug='squid' and protein ~ '(squid|오징어)')
       or (tag_slug='octopus' and protein ~ '(octopus|문어)')
       or (tag_slug='mussel' and protein ~ '(mussel|홍합)')
       or (tag_slug='shellfish' and protein ~ '(shellfish|clam|scallop|abalone|조개|가리비|전복)')
       or (tag_slug='wallaby' and protein ~ '(wallaby|왈라비)') then
      execute format(
        'insert into public.%I (%I,tag_id,source,confidence,reason)
         select $1,id,''existing_field'',''high'',''메인단백질 필드의 정규화 매핑''
         from public.food_tags where slug=$2 and is_active
         on conflict do nothing',
        join_table,id_column
      ) using p_product_id,tag_slug;

      if tag_slug = any(array[
        'bonito','hoki','bass','sea_bream','flatfish','tilapia','rockfish',
        'shrimp','krill','crab','lobster','squid','octopus','mussel','shellfish'
      ]) then
        specific_seafood := true;
      end if;
    end if;
  end loop;

  if specific_seafood then
    execute format(
      'delete from public.%I x using public.food_tags t
       where x.%I=$1 and x.tag_id=t.id and x.source<>''manual'' and t.slug=''fish''',
      join_table,id_column
    ) using p_product_id;
  end if;
end;
$$;

create or replace function public.sync_extended_protein_tags_row()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
begin
  perform public.sync_extended_protein_tags_for_product(
    case when tg_table_name='dog_feeds' then 'dog' else 'cat' end,
    new.id,
    new."메인단백질"
  );
  return new;
end;
$$;

drop trigger if exists zz_sync_extended_protein_tags_feed on public.feeds;
create trigger zz_sync_extended_protein_tags_feed
after insert or update of "메인단백질" on public.feeds
for each row execute function public.sync_extended_protein_tags_row();

drop trigger if exists zz_sync_extended_protein_tags_dog_feed on public.dog_feeds;
create trigger zz_sync_extended_protein_tags_dog_feed
after insert or update of "메인단백질" on public.dog_feeds
for each row execute function public.sync_extended_protein_tags_row();

-- Safe backfill for explicit dry soft/semi-moist product names only.
insert into public.dog_feed_food_tags (dog_feed_id,tag_id,source,confidence,reason)
select f.id,t.id,'product_name_derived','high','제품명에 소프트·반습식 제형이 명시됨'
from public.dog_feeds f
join public.food_tags t on t.slug='soft_semi_moist' and t.is_active
where f.type='dry'
  and lower(coalesce(f."제품명",'')) ~ '(소프트|반습식|semi[ -]?moist|soft[ -]?(kibble|dry|food))'
on conflict do nothing;

select public.sync_extended_protein_tags_for_product('cat',id,"메인단백질") from public.feeds;
select public.sync_extended_protein_tags_for_product('dog',id,"메인단백질") from public.dog_feeds;

revoke all on function public.sync_extended_protein_tags_for_product(text,uuid,text) from public,anon,authenticated;
revoke all on function public.sync_extended_protein_tags_row() from public,anon,authenticated;
grant execute on function public.sync_extended_protein_tags_for_product(text,uuid,text) to service_role;
grant execute on function public.sync_extended_protein_tags_row() to service_role;
