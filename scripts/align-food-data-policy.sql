-- Backfill only derived fields, preserving previous calculations and all source records.
with pending as (
 select id,public.proved_food_numeric_policy(to_jsonb(f)) patch,
 (select jsonb_object_agg(k,to_jsonb(f)->k) from jsonb_object_keys(public.proved_food_numeric_policy(to_jsonb(f))) k) previous
 from public.feeds f
), changed as (select * from pending where patch is distinct from previous)
update public.feeds f set final_me=f.final_me,
 source_urls=coalesce(f.source_urls,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('purpose','policy_alignment_20261118','previous_calculations',c.previous))
from changed c where f.id=c.id;
with pending as (
 select id,public.proved_food_numeric_policy(to_jsonb(f)) patch,
 (select jsonb_object_agg(k,to_jsonb(f)->k) from jsonb_object_keys(public.proved_food_numeric_policy(to_jsonb(f))) k) previous
 from public.dog_feeds f
), changed as (select * from pending where patch is distinct from previous)
update public.dog_feeds f set final_me=f.final_me,
 source_urls=coalesce(f.source_urls,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('purpose','policy_alignment_20261118','previous_calculations',c.previous))
from changed c where f.id=c.id;
