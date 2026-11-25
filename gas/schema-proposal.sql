-- PROPOSED migration: inspected production constraints on 2026-11-13.
-- Review and apply in a transaction through the Supabase SQL editor.
-- Does not update/delete any existing prices or review records.
begin;
create table public.proved_coupang_jobs (
  job_key text primary key,
  species text not null check (species in ('cat','dog')),
  feed_id uuid not null,
  outcome text not null check(outcome in ('accepted','insufficient_evidence','manual_review','retryable_error')),
  issue_type text,
  reason text not null,
  fingerprint text not null,
  audit jsonb not null default '{}'::jsonb,
  candidate_data jsonb not null default '{}'::jsonb,
  attempts integer not null default 1,
  next_retry_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(job_key=species||'|'||feed_id::text),
  check(jsonb_typeof(audit)='object' and jsonb_typeof(candidate_data)='object')
);
create index proved_coupang_jobs_retry_idx on public.proved_coupang_jobs(outcome,next_retry_at,job_key);
alter table public.proved_coupang_jobs enable row level security;
revoke all on public.proved_coupang_jobs from public,anon,authenticated;
grant select,insert,update on public.proved_coupang_jobs to service_role;

create table public.proved_coupang_normal_price_evidence (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  item_id text not null,
  vendor_item_id text not null check(btrim(vendor_item_id)<>''),
  title_hash text not null check(title_hash ~ '^[0-9a-f]{64}$'),
  unit_weight_g numeric not null check(unit_weight_g>0),
  pack_count integer not null check(pack_count between 1 and 1000),
  normal_price_krw numeric not null check(normal_price_krw>0),
  price_basis text not null check(price_basis='undiscounted_normal'),
  verification_status text not null check(verification_status in ('verified','revoked')),
  verification_source text not null check(verification_source in ('manual_coupang_detail','verified_source_adapter')),
  source_url text not null check(source_url ~* '^https://([a-z0-9-]+\.)?coupang\.com/'),
  evidence jsonb not null check(jsonb_typeof(evidence)='object' and evidence<>'{}'::jsonb),
  verified_at timestamptz not null,
  valid_until timestamptz not null,
  check(valid_until>verified_at)
);
create index proved_coupang_normal_price_lookup on public.proved_coupang_normal_price_evidence
  (product_id,item_id,vendor_item_id,verified_at desc);
alter table public.proved_coupang_normal_price_evidence enable row level security;
revoke all on public.proved_coupang_normal_price_evidence from public,anon,authenticated;
grant select,insert,update on public.proved_coupang_normal_price_evidence to service_role;

-- Latest processing state routes historical open rows without changing their history.
create view public.proved_coupang_manual_reviews with (security_invoker=true) as
select q.*,j.outcome as processing_outcome,j.reason as processing_reason
from public.food_price_review_queue q
left join public.proved_coupang_jobs j on j.job_key=q.species||'|'||coalesce(q.feed_id,q.dog_feed_id)::text
where q.status='open' and (j.job_key is null or j.outcome='manual_review');
revoke all on public.proved_coupang_manual_reviews from public,anon,authenticated;
grant select on public.proved_coupang_manual_reviews to service_role;

create function public.proved_save_coupang_job(p_job jsonb)
returns void language sql security invoker set search_path='' as $$
 insert into public.proved_coupang_jobs as old
 (job_key,species,feed_id,outcome,issue_type,reason,fingerprint,audit,candidate_data,updated_at,next_retry_at)
 values(p_job->>'job_key',p_job->>'species',(p_job->>'feed_id')::uuid,p_job->>'outcome',
 p_job->>'issue_type',p_job->>'reason',p_job->>'fingerprint',p_job->'audit',p_job->'candidate_data',now(),
 now()+case when p_job->>'outcome'='retryable_error' then interval '15 minutes' else interval '1 day' end)
 on conflict(job_key) do update set outcome=excluded.outcome,issue_type=excluded.issue_type,
 reason=excluded.reason,fingerprint=excluded.fingerprint,audit=excluded.audit,
 candidate_data=excluded.candidate_data,updated_at=excluded.updated_at,
 next_retry_at=excluded.next_retry_at,attempts=old.attempts+1;
$$;
revoke all on function public.proved_save_coupang_job(jsonb) from public,anon,authenticated;
grant execute on function public.proved_save_coupang_job(jsonb) to service_role;

-- A single transaction validates the evidence and inserts only if no reference exists.
-- Existing official/general references always win. The inspected per-feed unique
-- indexes arbitrate concurrent collection, diagnostic and external writer executions.
create function public.proved_insert_coupang_reference(
 p_species text,p_feed_id uuid,p_product_id text,p_item_id text,p_vendor_item_id text,
 p_title_hash text,p_weight numeric,p_count integer,p_basis text,p_evidence_id uuid)
returns table(action text,id uuid,source_type text,source_pack_price_krw numeric,
 source_pack_count integer,unit_weight_g numeric,price_per_100g_krw numeric)
language plpgsql security invoker set search_path='' as $$
declare e public.proved_coupang_normal_price_evidence%rowtype;
 r public.food_reference_prices%rowtype;
 inserted_id uuid;
begin
 if p_species is null or p_feed_id is null or p_species not in ('cat','dog') then raise exception 'invalid species'; end if;
 select * into e from public.proved_coupang_normal_price_evidence
 where proved_coupang_normal_price_evidence.id=p_evidence_id for share;
 if not found or e.verification_status<>'verified' or e.price_basis<>'undiscounted_normal'
 or e.verified_at>now() or e.valid_until<=now() or e.product_id is distinct from p_product_id
 or e.item_id is distinct from p_item_id or e.vendor_item_id is distinct from p_vendor_item_id or e.title_hash is distinct from p_title_hash
 or e.unit_weight_g is distinct from p_weight or e.pack_count is distinct from p_count then
   raise exception 'normal price evidence missing, expired or wrong option';
 end if;
 insert into public.food_reference_prices
 (species,feed_id,dog_feed_id,source_type,source_name,source_url,source_pack_price_krw,
 source_pack_count,unit_weight_g,reference_method,selection_basis,availability_status,
 verified_at,last_checked_at,updated_at,created_at)
 values(p_species,case when p_species='cat' then p_feed_id end,
 case when p_species='dog' then p_feed_id end,'coupang_general',
 'Coupang verified undiscounted normal price',e.source_url,e.normal_price_krw,e.pack_count,
 e.unit_weight_g,case when e.pack_count=1 then 'single_unit' else 'pack_normalized' end,
 p_basis,'unknown',now(),now(),now(),now())
 on conflict do nothing returning food_reference_prices.id into inserted_id;
 select * into r from public.food_reference_prices
 where (p_species='cat' and food_reference_prices.feed_id=p_feed_id)
 or (p_species='dog' and food_reference_prices.dog_feed_id=p_feed_id);
 if not found then raise exception 'reference insert/read conflict; retry'; end if;
 return query select case when inserted_id is not null then 'inserted'
 when r.source_type in ('brand_official','importer_official') then 'kept_higher_priority'
 else 'kept_existing_collection_phase' end,
 r.id,r.source_type,r.source_pack_price_krw,r.source_pack_count,r.unit_weight_g,r.price_per_100g_krw;
end;
$$;
revoke all on function public.proved_insert_coupang_reference(text,uuid,text,text,text,text,numeric,integer,text,uuid)
 from public,anon,authenticated;
grant execute on function public.proved_insert_coupang_reference(text,uuid,text,text,text,text,numeric,integer,text,uuid)
 to service_role;
commit;
