-- Preserve management-purpose tags for current Hill's Prescription Diet product-family aliases.
-- These rows use source='manual' so the conservative backfill keeps them on future reruns.

insert into public.feed_food_tags(feed_id,tag_id,source,confidence,reason)
select f.id,t.id,'manual','high','Hill''s Prescription Diet c/d Multicare 공식 요로 관리 제품군'
from public.feeds f cross join public.food_tags t
where t.slug='urinary'
  and lower(coalesce(f.제조사,'')) like '%hill%'
  and lower(f.제품명) ~ '(^|[^a-z])c/d([^a-z]|$)'
on conflict (feed_id,tag_id) do nothing;

insert into public.feed_food_tags(feed_id,tag_id,source,confidence,reason)
select f.id,t.id,'manual','high','Hill''s Prescription Diet z/d 공식 식이민감성·피부 관리 제품군'
from public.feeds f cross join public.food_tags t
where t.slug='skin_allergy'
  and lower(coalesce(f.제조사,'')) like '%hill%'
  and lower(f.제품명) ~ '(^|[^a-z])z/d([^a-z]|$)'
on conflict (feed_id,tag_id) do nothing;

insert into public.feed_food_tags(feed_id,tag_id,source,confidence,reason)
select f.id,t.id,'manual','high','Hill''s Prescription Diet Gastrointestinal Biome 공식 소화기 관리 제품군'
from public.feeds f cross join public.food_tags t
where t.slug='digestive'
  and lower(coalesce(f.제조사,'')) like '%hill%'
  and lower(f.제품명) ~ '(gi ?바이옴|gastrointestinal ?biome)'
on conflict (feed_id,tag_id) do nothing;

insert into public.feed_food_tags(feed_id,tag_id,source,confidence,reason)
select f.id,t.id,'manual','high','Hill''s Prescription Diet Metabolic 공식 체중관리 제품군'
from public.feeds f cross join public.food_tags t
where t.slug='weight_management'
  and lower(coalesce(f.제조사,'')) like '%hill%'
  and lower(f.제품명) ~ '(메타볼릭|metabolic)'
on conflict (feed_id,tag_id) do nothing;

insert into public.dog_feed_food_tags(dog_feed_id,tag_id,source,confidence,reason)
select f.id,t.id,'manual','high','Hill''s Prescription Diet z/d 공식 식이민감성·피부 관리 제품군'
from public.dog_feeds f cross join public.food_tags t
where t.slug='skin_allergy'
  and lower(coalesce(f.제조사,'')) like '%hill%'
  and lower(f.제품명) ~ '(^|[^a-z])z/d([^a-z]|$)'
on conflict (dog_feed_id,tag_id) do nothing;

insert into public.dog_feed_food_tags(dog_feed_id,tag_id,source,confidence,reason)
select f.id,t.id,'manual','high','Hill''s Prescription Diet Gastrointestinal Biome 공식 소화기 관리 제품군'
from public.dog_feeds f cross join public.food_tags t
where t.slug='digestive'
  and lower(coalesce(f.제조사,'')) like '%hill%'
  and lower(f.제품명) ~ '(gi ?바이옴|gastrointestinal ?biome)'
on conflict (dog_feed_id,tag_id) do nothing;

insert into public.dog_feed_food_tags(dog_feed_id,tag_id,source,confidence,reason)
select f.id,t.id,'manual','high','Hill''s Prescription Diet l/d 공식 간 건강 관리 제품군'
from public.dog_feeds f cross join public.food_tags t
where t.slug='hepatic'
  and lower(coalesce(f.제조사,'')) like '%hill%'
  and lower(f.제품명) ~ '(^|[^a-z])l/d([^a-z]|$)'
on conflict (dog_feed_id,tag_id) do nothing;
