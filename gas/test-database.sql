-- Isolated PostgreSQL 17 test only. Never run on production.
\set ON_ERROR_STOP on
insert into public.feeds values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.proved_coupang_normal_price_evidence
(id,product_id,item_id,vendor_item_id,title_hash,unit_weight_g,pack_count,normal_price_krw,price_basis,
 verification_status,verification_source,source_url,evidence,verified_at,valid_until)
values('00000000-0000-0000-0000-000000000010','1','2','3',repeat('a',64),85,6,12000,
'undiscounted_normal','verified','manual_coupang_detail','https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3',
'{"label":"할인 전 정상가","capture":"isolated fixture"}',now()-interval '1 minute',now()+interval '1 day');
set role service_role;
select * from public.proved_insert_coupang_reference('cat','00000000-0000-0000-0000-000000000001',
'1','2','3',repeat('a',64),85,6,'wet_smallest_pack','00000000-0000-0000-0000-000000000010');
select * from public.proved_insert_coupang_reference('cat','00000000-0000-0000-0000-000000000001',
'1','2','3',repeat('a',64),85,6,'wet_smallest_pack','00000000-0000-0000-0000-000000000010');
do $$ begin
 if (select count(*) from public.food_reference_prices)<>1 then raise exception 'duplicate price'; end if;
 if (select reference_price_krw from public.food_reference_prices limit 1)<>2000 then raise exception 'unit calculation'; end if;
 if (select price_per_100g_krw from public.food_reference_prices limit 1)<>2352.94 then raise exception '100g calculation'; end if;
 begin
 perform public.proved_insert_coupang_reference('cat','00000000-0000-0000-0000-000000000001',
 '1','2','wrong',repeat('a',64),85,6,'wet_smallest_pack','00000000-0000-0000-0000-000000000010');
 raise exception 'wrong seller accepted';
 exception when raise_exception then if sqlerrm='wrong seller accepted' then raise; end if; end;
 begin
 perform public.proved_insert_coupang_reference('cat','00000000-0000-0000-0000-000000000001',
 '1','2','3',null,85,6,'wet_smallest_pack','00000000-0000-0000-0000-000000000010');
 raise exception 'null title accepted';
 exception when raise_exception then if sqlerrm='null title accepted' then raise; end if; end;
end $$;
select public.proved_save_coupang_job('{"job_key":"cat|00000000-0000-0000-0000-000000000001","species":"cat","feed_id":"00000000-0000-0000-0000-000000000001","outcome":"insufficient_evidence","reason":"package missing","fingerprint":"test","audit":{},"candidate_data":{}}');
select public.proved_save_coupang_job('{"job_key":"cat|00000000-0000-0000-0000-000000000001","species":"cat","feed_id":"00000000-0000-0000-0000-000000000001","outcome":"retryable_error","reason":"API error","fingerprint":"test","audit":{},"candidate_data":{}}');
do $$ begin
 if (select count(*) from public.proved_coupang_jobs)<>1 then raise exception 'duplicate job'; end if;
 if (select attempts from public.proved_coupang_jobs)<>2 then raise exception 'attempt counter'; end if;
end $$;
reset role;
-- Official row remains byte-for-byte unchanged after attempted insert.
insert into public.food_reference_prices(species,feed_id,source_type,source_name,source_url,
source_pack_price_krw,source_pack_count,unit_weight_g,reference_method,selection_basis,availability_status,
verified_at,last_checked_at,updated_at,created_at)
values('cat','00000000-0000-0000-0000-000000000002','brand_official','official','https://example.com',
30000,1,1000,'single_unit','manual_review','unknown',now(),now(),now(),now());
create temporary table original_price as select * from public.food_reference_prices where feed_id='00000000-0000-0000-0000-000000000002';
set role service_role;
select * from public.proved_insert_coupang_reference('cat','00000000-0000-0000-0000-000000000002',
'1','2','3',repeat('a',64),85,6,'wet_smallest_pack','00000000-0000-0000-0000-000000000010');
reset role;
do $$ begin
 if exists(select * from original_price except select * from public.food_reference_prices) then raise exception 'official overwritten'; end if;
end $$;
-- Deferred rows are hidden, legacy history preserved; true manual conflicts visible.
insert into public.food_price_review_queue(species,feed_id,status,issue_type,candidate_data)
values('cat','00000000-0000-0000-0000-000000000001','open','ambiguous_package','{}');
set role service_role;
do $$ begin
 if (select count(*) from public.proved_coupang_manual_reviews)<>0 then raise exception 'retry job in human view'; end if;
 if (select count(*) from public.food_price_review_queue)<>1 then raise exception 'history removed'; end if;
end $$;
reset role;
update public.proved_coupang_jobs set outcome='manual_review';
set role service_role;
do $$ begin
 if (select count(*) from public.proved_coupang_manual_reviews)<>1 then raise exception 'manual conflict hidden'; end if;
end $$;
reset role;
set role anon;
do $$ begin
 begin perform * from public.proved_coupang_normal_price_evidence; raise exception 'anon read succeeded';
 exception when insufficient_privilege then null; end;
 begin perform public.proved_save_coupang_job('{}'); raise exception 'anon RPC succeeded';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: insert, duplicate, normalization, wrong seller, NULL proof, job upsert, official protection, routing/history, anon denial' as result;
