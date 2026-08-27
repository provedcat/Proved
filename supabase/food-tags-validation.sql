-- Run after 20260827000000_create_food_tag_taxonomy_and_backfill.sql.
-- 1) Catalogue coverage
select * from public.backfill_food_tags();

-- 2) Counts for every taxonomy entry, including zeroes, by species
select s.species, t.category, t.slug, t.label_ko, count(x.tag_id) as product_count
from (values ('cat'),('dog')) s(species)
cross join public.food_tags t
left join (
  select 'cat' species, feed_id product_id, tag_id from public.feed_food_tags
  union all select 'dog', dog_feed_id, tag_id from public.dog_feed_food_tags
) x on x.species=s.species and x.tag_id=t.id
group by s.species,t.category,t.slug,t.label_ko,t.sort_order
order by s.species,t.category,t.sort_order,t.slug;

-- 3) Expected multi-axis combinations
select 'cat' species, x.feed_id product_id, array_agg(t.slug order by t.slug) tags
from public.feed_food_tags x join public.food_tags t on t.id=x.tag_id
where t.slug in ('raw','freeze_dried') group by x.feed_id having count(distinct t.slug)=2
union all
select 'dog', x.dog_feed_id, array_agg(t.slug order by t.slug)
from public.dog_feed_food_tags x join public.food_tags t on t.id=x.tag_id
where t.slug in ('raw','freeze_dried') group by x.dog_feed_id having count(distinct t.slug)=2;

select 'cat' species, x.feed_id product_id, array_agg(t.slug order by t.slug) tags
from public.feed_food_tags x join public.food_tags t on t.id=x.tag_id
where t.slug in ('veterinary_diet','urinary') group by x.feed_id having count(distinct t.slug)=2
union all
select 'dog', x.dog_feed_id, array_agg(t.slug order by t.slug)
from public.dog_feed_food_tags x join public.food_tags t on t.id=x.tag_id
where t.slug in ('veterinary_diet','urinary') group by x.dog_feed_id having count(distinct t.slug)=2;

-- 4) Duplicates (both results must be empty)
select feed_id,tag_id,count(*) from public.feed_food_tags group by feed_id,tag_id having count(*)>1;
select dog_feed_id,tag_id,count(*) from public.dog_feed_food_tags group by dog_feed_id,tag_id having count(*)>1;

-- 5) Orphans (all counts must be zero; FKs also enforce this)
select
  (select count(*) from public.feed_food_tags x left join public.feeds f on f.id=x.feed_id where f.id is null) cat_product_orphans,
  (select count(*) from public.dog_feed_food_tags x left join public.dog_feeds f on f.id=x.dog_feed_id where f.id is null) dog_product_orphans,
  (select count(*) from public.feed_food_tags x left join public.food_tags t on t.id=x.tag_id where t.id is null)
  +(select count(*) from public.dog_feed_food_tags x left join public.food_tags t on t.id=x.tag_id where t.id is null) tag_orphans;

-- 6) Human-review backlog by reason and affected product
select species,issue_type,count(*) product_count from public.food_tag_review_queue
where status='open' group by species,issue_type order by species,issue_type;
select species,product_id,issue_type,reason,evidence from public.food_tag_review_queue
where status='open' order by species,product_id,issue_type;

-- Distinct source values and mapping coverage. Any value in the second result needs
-- an explicit taxonomy/alias decision before the migration is promoted.
select species, main_protein, count(*) product_count
from (
  select 'cat'::text species, nullif(btrim(메인단백질), '') main_protein from public.feeds
  union all
  select 'dog', nullif(btrim(메인단백질), '') from public.dog_feeds
) p where main_protein is not null
group by species,main_protein order by species,product_count desc,main_protein;

select q.species,q.main_protein,count(*) product_count
from (
  select 'cat'::text species,f.id,f.메인단백질 main_protein
  from public.feeds f
  where nullif(btrim(f.메인단백질),'') is not null
    and not exists (
      select 1 from public.feed_food_tags x join public.food_tags t on t.id=x.tag_id
      where x.feed_id=f.id and t.category='protein_source'
    )
  union all
  select 'dog',f.id,f.메인단백질
  from public.dog_feeds f
  where nullif(btrim(f.메인단백질),'') is not null
    and not exists (
      select 1 from public.dog_feed_food_tags x join public.food_tags t on t.id=x.tag_id
      where x.dog_feed_id=f.id and t.category='protein_source'
    )
) q group by q.species,q.main_protein order by q.species,product_count desc,q.main_protein;

-- Every non-empty, unmapped main-protein value must have the corresponding open
-- review item. This result must be empty.
select q.species,q.id,q.main_protein
from (
  select 'cat'::text species,f.id,f.메인단백질 main_protein
  from public.feeds f
  where nullif(btrim(f.메인단백질),'') is not null
    and not exists (
      select 1 from public.feed_food_tags x join public.food_tags t on t.id=x.tag_id
      where x.feed_id=f.id and t.category='protein_source'
    )
  union all
  select 'dog',f.id,f.메인단백질
  from public.dog_feeds f
  where nullif(btrim(f.메인단백질),'') is not null
    and not exists (
      select 1 from public.dog_feed_food_tags x join public.food_tags t on t.id=x.tag_id
      where x.dog_feed_id=f.id and t.category='protein_source'
    )
) q
where not exists (
  select 1 from public.food_tag_review_queue r
  where r.species=q.species and r.product_id=q.id
    and r.issue_type='unknown_protein_source' and r.status='open'
);

-- 7) Chicken-free samples with complete evidence; inspect at least 10/species.
select 'cat' species,f.id,f.제조사,f.제품명,f.전성분,x.reason
from public.feed_food_tags x join public.food_tags t on t.id=x.tag_id join public.feeds f on f.id=x.feed_id
where t.slug='chicken_free' order by random() limit 10;
select 'dog' species,f.id,f.제조사,f.제품명,f.전성분,x.reason
from public.dog_feed_food_tags x join public.food_tags t on t.id=x.tag_id join public.dog_feeds f on f.id=x.dog_feed_id
where t.slug='chicken_free' order by random() limit 10;

-- 8) Veterinary-diet samples, with independent management-purpose tags alongside.
select 'cat' species,f.id,f.제조사,f.제품명,
       array_agg(t.slug order by t.category,t.sort_order) filter(where t.category in ('product_class','management_purpose')) tags
from public.feed_food_tags x join public.food_tags t on t.id=x.tag_id join public.feeds f on f.id=x.feed_id
where exists(select 1 from public.feed_food_tags v join public.food_tags vt on vt.id=v.tag_id where v.feed_id=f.id and vt.slug='veterinary_diet')
group by f.id,f.제조사,f.제품명 order by f.id;

select 'dog' species,f.id,f.제조사,f.제품명,
       array_agg(t.slug order by t.category,t.sort_order) filter(where t.category in ('product_class','management_purpose')) tags
from public.dog_feed_food_tags x join public.food_tags t on t.id=x.tag_id join public.dog_feeds f on f.id=x.dog_feed_id
where exists(select 1 from public.dog_feed_food_tags v join public.food_tags vt on vt.id=v.tag_id where v.dog_feed_id=f.id and vt.slug='veterinary_diet')
group by f.id,f.제조사,f.제품명 order by f.id;

-- Official-line candidate audit and false-positive guard. The first query should
-- include every official line; the second result must be empty.
select species,id,제조사,제품명 from (
  select 'cat'::text species,id,제조사,제품명 from public.feeds
  union all select 'dog',id,제조사,제품명 from public.dog_feeds
) p where lower(concat_ws(' ',제조사,제품명)) ~
  '(royal canin|로얄캐닌).*(veterinary|vet ?diet|벳 ?다이어트|s ?/ ?o|early ?renal|renal|gastro ?intestinal|gastrointestinal|hepatic|satiety|anallergenic)|(hill''?s|힐스).*(prescription diet|프리 ?스크립션( ?다이어트)?)|(farmina|파미나).*(vet ?life|벳 ?라이프)|(monge|몬지).*(vetsolution|vet ?solution|벳 ?솔루션|벳솔루션)|(v[.]?o[.]?m|브이오엠).*(rx|알엑스)'
  and lower(concat_ws(' ',제조사,제품명)) !~
  '(royal canin|로얄캐닌).*(urinary ?care|digestive ?care|light ?weight ?care)'
order by species,제조사,제품명;

select p.species,p.id,p.제조사,p.제품명
from (
  select 'cat'::text species,f.id,f.제조사,f.제품명,t.slug
  from public.feeds f join public.feed_food_tags x on x.feed_id=f.id join public.food_tags t on t.id=x.tag_id
  union all
  select 'dog',f.id,f.제조사,f.제품명,t.slug
  from public.dog_feeds f join public.dog_feed_food_tags x on x.dog_feed_id=f.id join public.food_tags t on t.id=x.tag_id
) p
where p.slug='veterinary_diet' and lower(concat_ws(' ',p.제조사,p.제품명)) !~
  '(royal canin|로얄캐닌).*(veterinary|vet ?diet|벳 ?다이어트|s ?/ ?o|early ?renal|renal|gastro ?intestinal|gastrointestinal|hepatic|satiety|anallergenic)|(hill''?s|힐스).*(prescription diet|프리 ?스크립션( ?다이어트)?)|(farmina|파미나).*(vet ?life|벳 ?라이프)|(monge|몬지).*(vetsolution|vet ?solution|벳 ?솔루션|벳솔루션)|(v[.]?o[.]?m|브이오엠).*(rx|알엑스)';

-- Royal Canin official Veterinary families that were not tagged. This result
-- must be empty; ordinary Urinary/Digestive/Light Weight Care lines are excluded.
select p.species,p.id,p.제조사,p.제품명
from (
  select 'cat'::text species,id,제조사,제품명 from public.feeds
  union all select 'dog',id,제조사,제품명 from public.dog_feeds
) p
where lower(concat_ws(' ',p.제조사,p.제품명)) ~ '(royal canin|로얄캐닌)'
  and lower(p.제품명) ~ '(veterinary|vet ?diet|벳 ?다이어트|s ?/ ?o|early ?renal|renal|gastro ?intestinal|gastrointestinal|hepatic|satiety|anallergenic)'
  and lower(p.제품명) !~ '(urinary ?care|digestive ?care|light ?weight ?care)'
  and not exists (
    select 1 from (
      select 'cat'::text species,x.feed_id product_id
      from public.feed_food_tags x join public.food_tags t on t.id=x.tag_id where t.slug='veterinary_diet'
      union all
      select 'dog',x.dog_feed_id
      from public.dog_feed_food_tags x join public.food_tags t on t.id=x.tag_id where t.slug='veterinary_diet'
    ) tagged where tagged.species=p.species and tagged.product_id=p.id
  );

-- Recommended AND query (cat example): replace the array with requested slugs.
select f.* from public.feeds f
join public.feed_food_tags x on x.feed_id=f.id join public.food_tags t on t.id=x.tag_id
where t.is_active and t.slug=any(array['raw','freeze_dried','beef'])
group by f.id having count(distinct t.slug)=cardinality(array['raw','freeze_dried','beef']);
