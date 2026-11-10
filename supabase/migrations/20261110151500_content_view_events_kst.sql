-- PROVED editorial and product view analytics
-- Applied to the live Supabase project on 2026-11-10.
-- Safe to re-run when rebuilding a new project.
create table if not exists public.content_analytics_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  registered_at timestamptz not null default now()
);
alter table public.content_analytics_admins enable row level security;
revoke all on public.content_analytics_admins from anon, authenticated;

create table if not exists public.content_view_events (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  content_type text not null check (content_type in ('editorial','product')),
  content_key text not null,
  content_path text not null,
  content_title text not null,
  previous_content_key text,
  viewed_at timestamptz not null default now()
);
create index if not exists content_view_events_dedupe_idx
  on public.content_view_events(visitor_id, content_key, viewed_at desc);
create index if not exists content_view_events_content_idx
  on public.content_view_events(content_key, viewed_at desc);
create index if not exists content_view_events_time_idx
  on public.content_view_events(viewed_at desc, id desc);
alter table public.content_view_events enable row level security;
revoke all on public.content_view_events from anon, authenticated;
revoke all on sequence public.content_view_events_id_seq from anon, authenticated;

create or replace function public.record_content_view(
  p_visitor_id uuid,
  p_content_type text,
  p_content_id text,
  p_content_title text default null,
  p_previous_content_key text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_key text;
  v_path text;
  v_content uuid;
  v_species text;
  v_id text;
begin
  if p_visitor_id is null or substring(p_visitor_id::text, 15, 1) <> '4' then return false; end if;
  if auth.uid() is not null and exists (
    select 1 from public.content_analytics_admins a where a.user_id = auth.uid()
  ) then return false; end if;

  if p_content_type = 'editorial' then
    if p_content_id is null or p_content_id !~ '^[a-z0-9][a-z0-9-]{0,90}$' then return false; end if;
    v_key := 'editorial:' || p_content_id;
    v_path := '/editorial/' || p_content_id || '/';
  elsif p_content_type = 'product' then
    if p_content_id is null or p_content_id !~ '^(cat|dog):[0-9a-fA-F-]{36}$' then return false; end if;
    v_species := split_part(p_content_id, ':', 1);
    v_id := split_part(p_content_id, ':', 2);
    begin
      v_content := v_id::uuid;
    exception when invalid_text_representation then return false;
    end;
    if v_species = 'cat' then
      if not exists (select 1 from public.feeds where id = v_content) then return false; end if;
    else
      if not exists (select 1 from public.dog_feeds where id = v_content) then return false; end if;
    end if;
    v_key := 'product:' || v_species || ':' || v_content::text;
    v_path := '/food/?species=' || v_species || '&id=' || v_content::text;
  else
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_visitor_id::text || ':' || v_key, 0));
  if exists (
    select 1 from public.content_view_events
    where visitor_id = p_visitor_id and content_key = v_key
      and viewed_at > now() - interval '24 hours'
  ) then return false; end if;
  if (
    select count(*) from public.content_view_events
    where visitor_id = p_visitor_id and viewed_at > now() - interval '24 hours'
  ) >= 300 then return false; end if;

  insert into public.content_view_events
    (visitor_id,content_type,content_key,content_path,content_title,previous_content_key)
  values
    (p_visitor_id,p_content_type,v_key,v_path,left(coalesce(nullif(btrim(p_content_title),''),v_key),180),
     case when length(p_previous_content_key) <= 160 then p_previous_content_key else null end);
  return true;
end;
$$;

revoke all on function public.record_content_view(uuid,text,text,text,text) from public;
grant execute on function public.record_content_view(uuid,text,text,text,text) to anon, authenticated;

create or replace view public.content_view_log_kst
with (security_invoker = true)
as
select
  e.id,
  e.viewed_at at time zone 'Asia/Seoul' as viewed_at_kst,
  (e.viewed_at at time zone 'Asia/Seoul')::date as view_date_kst,
  e.visitor_id,
  row_number() over (partition by e.visitor_id order by e.viewed_at, e.id) as visitor_visit_order,
  e.content_type, e.content_title, e.content_path, e.content_key,
  e.previous_content_key,
  count(*) over (partition by e.content_key order by e.viewed_at, e.id) as cumulative_views
from public.content_view_events e;

create or replace view public.content_view_totals_kst
with (security_invoker = true)
as
select
  content_key,
  max(content_type) as content_type,
  max(content_title) as content_title,
  count(*)::bigint as cumulative_views,
  (max(viewed_at) at time zone 'Asia/Seoul') as last_viewed_at_kst
from public.content_view_events
group by content_key;

revoke all on public.content_view_log_kst, public.content_view_totals_kst from anon, authenticated;
comment on table public.content_view_events is
  'Visitor-level editorial/product views; 24h per-content dedup, no IP/email recorded.';
comment on table public.content_analytics_admins is
  'Verified Supabase auth user IDs excluded from views. Explicit enrollment required.';
