-- Upgrade existing production 1.3.1 schema. Run in staging first.
-- No existing job/review/price rows are updated or deleted by this upgrade.
begin;
alter table public.proved_coupang_jobs drop constraint proved_coupang_jobs_outcome_check;
alter table public.proved_coupang_jobs add constraint proved_coupang_jobs_outcome_check
 check(outcome in ('accepted','insufficient_evidence','manual_review','retryable_error','retry_exhausted','blocked_error'));

create table public.proved_gemini_quota (
 scope text not null, model text not null, rpm integer not null check(rpm>0),
 rpd integer not null check(rpd>0), paused_until timestamptz,
 primary key(scope,model)
);
create table public.proved_gemini_calls (
 id uuid primary key default gen_random_uuid(), scope text not null, model text not null,
 job_key text not null, fingerprint text not null,
 started_at timestamptz not null default clock_timestamp(),
 lease_until timestamptz not null default clock_timestamp()+interval '7 minutes',
 finished_at timestamptz, result jsonb not null default '{}'::jsonb
);
create index proved_gemini_calls_budget_idx on public.proved_gemini_calls(scope,model,started_at);
create index proved_gemini_calls_job_idx on public.proved_gemini_calls(job_key,started_at);
alter table public.proved_gemini_quota enable row level security;
alter table public.proved_gemini_calls enable row level security;
revoke all on public.proved_gemini_quota,public.proved_gemini_calls from public,anon,authenticated;
grant select,insert,update on public.proved_gemini_quota,public.proved_gemini_calls to service_role;

create function public.proved_reserve_gemini_call(p_scope text,p_model text,p_job_key text,
 p_fingerprint text,p_rpm integer,p_rpd integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare q public.proved_gemini_quota%rowtype; t timestamptz:=clock_timestamp();
 day_start timestamptz; n bigint; last_start timestamptz; rid uuid; cached jsonb;
begin
 if coalesce(btrim(p_scope),'')='' or coalesce(btrim(p_model),'')=''
 or p_rpm is null or p_rpm<1 or p_rpd is null or p_rpd<1 then raise exception 'invalid quota configuration'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_job_key,0));
 insert into public.proved_gemini_quota(scope,model,rpm,rpd) values(p_scope,p_model,p_rpm,p_rpd)
 on conflict(scope,model) do update set rpm=least(proved_gemini_quota.rpm,excluded.rpm),
 rpd=least(proved_gemini_quota.rpd,excluded.rpd);
 select * into q from public.proved_gemini_quota where scope=p_scope and model=p_model for update;
 -- Row lock serializes reservations across all cooperating GAS projects.
 t:=clock_timestamp();
 select result->'judgments' into cached from public.proved_gemini_calls
 where scope=p_scope and model=p_model and fingerprint=p_fingerprint and job_key=p_job_key
 and result->>'validation'='valid' order by started_at desc limit 1;
 if cached is not null then return jsonb_build_object('allowed',true,'judgments',cached); end if;
 select count(*) into n from public.proved_gemini_calls where job_key=p_job_key;
 if n>=5 or exists(select 1 from public.proved_coupang_jobs where job_key=p_job_key and attempts>=5)
 then return jsonb_build_object('allowed',false,'reason','retry_exhausted'); end if;
 if q.paused_until>t then return jsonb_build_object('allowed',false,'reason','circuit_open','retry_at',q.paused_until); end if;
 select max(lease_until) into last_start from public.proved_gemini_calls
 where scope=p_scope and model=p_model and finished_at is null and lease_until>t;
 if last_start is not null then return jsonb_build_object('allowed',false,'reason','concurrency','retry_at',last_start); end if;
 day_start:=date_trunc('day',t at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
 select count(*) into n from public.proved_gemini_calls where scope=p_scope and model=p_model and started_at>=day_start;
 if n>=q.rpd then
  last_start:=((day_start at time zone 'America/Los_Angeles')+interval '1 day') at time zone 'America/Los_Angeles';
  update public.proved_gemini_quota set paused_until=last_start where scope=p_scope and model=p_model;
  return jsonb_build_object('allowed',false,'reason','daily_budget','retry_at',last_start);
 end if;
 select count(*),min(started_at) into n,last_start from public.proved_gemini_calls
 where scope=p_scope and model=p_model and started_at>t-interval '1 minute';
 if n>=q.rpm then return jsonb_build_object('allowed',false,'reason','minute_budget','retry_at',last_start+interval '1 minute'); end if;
 insert into public.proved_gemini_calls(scope,model,job_key,fingerprint) values(p_scope,p_model,p_job_key,p_fingerprint) returning id into rid;
 return jsonb_build_object('allowed',true,'request_id',rid);
end $$;

create function public.proved_finish_gemini_call(p_id uuid,p_result jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.proved_gemini_calls%rowtype; until_at timestamptz; t timestamptz:=clock_timestamp();
begin
 -- Same lock order as reserve: quota then call. Finished calls are idempotent.
 select * into c from public.proved_gemini_calls where id=p_id;
 if not found then raise exception 'unknown Gemini reservation'; end if;
 perform 1 from public.proved_gemini_quota where scope=c.scope and model=c.model for update;
 select * into c from public.proved_gemini_calls where id=p_id for update;
 if c.finished_at is not null then
  if p_result->>'validation' in ('valid','schema_error') then
   update public.proved_gemini_calls set result=result||p_result where id=p_id;
   return c.result||p_result;
  end if;
  return c.result;
 end if;
 if p_result->>'error_type'='daily_quota' then
  until_at:=(date_trunc('day',t at time zone 'America/Los_Angeles')+interval '1 day') at time zone 'America/Los_Angeles';
 end if;
 if p_result->>'http_status'='429' then
  until_at:=greatest(until_at,t+interval '1 minute',nullif(p_result->>'retry_at','')::timestamptz);
  update public.proved_gemini_quota set paused_until=greatest(paused_until,until_at) where scope=c.scope and model=c.model;
 end if;
 update public.proved_gemini_calls set finished_at=t,lease_until=t,
 result=p_result||jsonb_build_object('retry_at',coalesce(until_at,nullif(p_result->>'retry_at','')::timestamptz)) where id=p_id;
 return p_result||jsonb_build_object('retry_at',coalesce(until_at,nullif(p_result->>'retry_at','')::timestamptz));
end $$;

create or replace function public.proved_save_coupang_job(p_job jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare old public.proved_coupang_jobs%rowtype; n integer; consume boolean;
 outcome_value text; retry_at timestamptz; a jsonb;
begin
 -- Serializes even the first insertion; preserves historical lifetime attempts.
 perform pg_advisory_xact_lock(hashtextextended(p_job->>'job_key',0));
 select * into old from public.proved_coupang_jobs where job_key=p_job->>'job_key' for update;
 consume:=coalesce((p_job->'audit'->>'attempt_consumed')::boolean,true);
 if old.attempts>=5
 and p_job->>'outcome' in ('retryable_error','retry_exhausted') then consume:=false; end if;
 n:=coalesce(old.attempts,0)+case when consume then 1 else 0 end;
 n:=greatest(n,1);
 outcome_value:=p_job->>'outcome';
 if outcome_value='retryable_error' and n>=5 then outcome_value:='retry_exhausted'; end if;
 a:=coalesce(p_job->'audit','{}'::jsonb);
 if old.fingerprint=p_job->>'fingerprint' then
  a:=coalesce(old.audit,'{}'::jsonb)||a;
 end if;
 a:=a||jsonb_build_object('total_gemini_calls',coalesce((old.audit->>'total_gemini_calls')::bigint,0)
  +coalesce((p_job->'audit'->>'calls')::integer,0));
 if outcome_value='retryable_error' then
  retry_at:=greatest(clock_timestamp()+make_interval(secs=>least(3600,60*power(2,least(n-1,6))) * (0.5+random()*0.5)),
   nullif(a->>'retry_at','')::timestamptz);
 elsif outcome_value in ('retry_exhausted','blocked_error','accepted','manual_review') then retry_at:='infinity';
 else retry_at:=clock_timestamp()+interval '1 day'; end if;
 insert into public.proved_coupang_jobs(job_key,species,feed_id,outcome,issue_type,reason,fingerprint,audit,candidate_data,attempts,next_retry_at,updated_at)
 values(p_job->>'job_key',p_job->>'species',(p_job->>'feed_id')::uuid,outcome_value,p_job->>'issue_type',p_job->>'reason',
 p_job->>'fingerprint',a,p_job->'candidate_data',n,retry_at,clock_timestamp())
 on conflict(job_key) do update set outcome=excluded.outcome,issue_type=excluded.issue_type,reason=excluded.reason,
 fingerprint=excluded.fingerprint,audit=excluded.audit,candidate_data=excluded.candidate_data,
 attempts=excluded.attempts,next_retry_at=excluded.next_retry_at,updated_at=excluded.updated_at;
end $$;
revoke all on function public.proved_reserve_gemini_call(text,text,text,text,integer,integer),
 public.proved_finish_gemini_call(uuid,jsonb),public.proved_save_coupang_job(jsonb) from public,anon,authenticated;
grant execute on function public.proved_reserve_gemini_call(text,text,text,text,integer,integer),
 public.proved_finish_gemini_call(uuid,jsonb),public.proved_save_coupang_job(jsonb) to service_role;

-- Classification changes only the view: no historical rows are mutated.
create view public.proved_coupang_review_triage with (security_invoker=true) as
select q.*,coalesce(j.outcome,
 case
 when q.issue_type in ('search_failed','pipeline_error','gemini_rate_limit','gemini_api_error')
  or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(q.candidate_data->'searches')='array'
   then q.candidate_data->'searches' else '[]'::jsonb end) s where s->>'ok'='false')
 then 'retryable_error'
 when q.issue_type in ('conflicting_normal_prices','conflicting_package_evidence','conflicting_identity_evidence')
  or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(q.candidate_data->'package_candidates')='array'
    then q.candidate_data->'package_candidates' else '[]'::jsonb end) c
    where c->'package_info'->>'parse_method' like '%conflicting%'
    and case when jsonb_typeof(c->'match_score')='number' then (c->>'match_score')::numeric else 0 end>=0.65)
 then 'manual_review'
 else 'insufficient_evidence' end) as processing_outcome,
 coalesce(j.reason,case when q.issue_type in ('conflicting_normal_prices','conflicting_package_evidence','conflicting_identity_evidence')
 then 'stored_evidence_conflict' else 'legacy_evidence_requires_verification' end) as processing_reason
from public.food_price_review_queue q
left join public.proved_coupang_jobs j on j.job_key=q.species||'|'||coalesce(q.feed_id,q.dog_feed_id)::text
where q.status='open';
create or replace view public.proved_coupang_manual_reviews with (security_invoker=true) as
select * from public.proved_coupang_review_triage where processing_outcome='manual_review';
create view public.proved_coupang_gemini_usage with (security_invoker=true) as
select job_key,scope,model,count(*) as reserved_calls,
 count(*) filter(where result->>'http_status'='429') as rate_limited_calls,
 count(*) filter(where finished_at is null) as unfinished_calls,
 sum(coalesce((result->'usage'->>'promptTokenCount')::bigint,0)) as input_tokens,
 sum(coalesce((result->'usage'->>'candidatesTokenCount')::bigint,0)
  +coalesce((result->'usage'->>'thoughtsTokenCount')::bigint,0)) as output_and_thought_tokens,
 case when model='gemini-3-flash-preview' then
 sum(coalesce((result->'usage'->>'promptTokenCount')::numeric,0)*0.50
  +(coalesce((result->'usage'->>'candidatesTokenCount')::numeric,0)
   +coalesce((result->'usage'->>'thoughtsTokenCount')::numeric,0))*3.00)/1000000 end as estimated_usd
from public.proved_gemini_calls group by job_key,scope,model;
revoke all on public.proved_coupang_review_triage,public.proved_coupang_gemini_usage from public,anon,authenticated;
grant select on public.proved_coupang_review_triage,public.proved_coupang_gemini_usage to service_role;
commit;
