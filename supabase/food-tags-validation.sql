-- Run after 20260827000000_create_food_tag_taxonomy_and_backfill.sql.
-- 1) Catalogue coverage
select * from public.backfill_food_tags();

-- 2) Counts for every taxonomy entry, including zeroes, by species
select s.species, t.category, t.slug, t.label_ko, count(x.tag_id) as product_count
from (values ('cat'),('dog')) s(species)
cross join public.food_tags t
left join (
  select 'cat' species, feed_id::bigint product_id, tag_id from public.feed_food_tags
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

-- Recommended AND query (cat example): replace the array with requested slugs.
select f.* from public.feeds f
join public.feed_food_tags x on x.feed_id=f.id join public.food_tags t on t.id=x.tag_id
where t.is_active and t.slug=any(array['raw','freeze_dried','beef'])
group by f.id having count(distinct t.slug)=cardinality(array['raw','freeze_dried','beef']);
