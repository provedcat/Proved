-- Additive analytics diagnostics; old clients and historical rows remain intact.
alter table public.content_view_events
  add column if not exists event_token uuid,
  add column if not exists session_id uuid,
  add column if not exists visitor_id_status text,
  add column if not exists storage_type text,
  add column if not exists user_agent text,
  add column if not exists referrer_domain text,
  add column if not exists landing_path text,
  add column if not exists page_path text,
  add column if not exists webdriver_reported boolean,
  add column if not exists traffic_type text,
  add column if not exists classification_reason text,
  add column if not exists engagement_seconds integer,
  add column if not exists interaction_observed boolean;
create unique index if not exists content_view_events_event_token_uidx on public.content_view_events(event_token);
alter table public.content_view_events enable row level security;
revoke all on public.content_view_events from public, anon, authenticated;

create or replace function public.record_content_view_v2(
  p_visitor_id uuid,
  p_content_type text,
  p_content_id text,
  p_content_title text,
  p_previous_content_key text,
  p_event_token uuid,
  p_context jsonb
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
  v_ua text;
  v_ref text;
  v_session uuid;
  v_storage text;
  v_status text;
  v_landing text;
  v_actual text;
  v_webdriver boolean;
  v_suspect boolean;
begin
  if p_event_token is null or substring(p_event_token::text,15,1) <> '4' then return false; end if;
  if p_context is null or jsonb_typeof(p_context) <> 'object' or octet_length(p_context::text) > 4096 then return false; end if;
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

  -- Request UA is observed by the server, but remains spoofable.
  v_ua := left(nullif(current_setting('request.headers',true),'')::jsonb->>'user-agent', 256);
  v_ref := lower(left(p_context->>'referrer_domain',253));
  if v_ref !~ '^[a-z0-9.-]+
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
    (visitor_id,content_type,content_key,content_path,content_title,previous_content_key,
     event_token, session_id, visitor_id_status, storage_type, user_agent, referrer_domain, landing_path, page_path,
     webdriver_reported, traffic_type, classification_reason, engagement_seconds, interaction_observed)
  values
    (p_visitor_id,p_content_type,v_key,v_path,left(coalesce(nullif(btrim(p_content_title),''),v_key),180),
     case when length(p_previous_content_key) <= 160 then p_previous_content_key else null end,
     p_event_token, v_session, v_status, v_storage, v_ua, v_ref, v_landing, v_actual,
     v_webdriver, case when v_suspect then 'suspected_bot' else 'unknown' end,
     case when coalesce(v_webdriver,false) then 'client_webdriver'
          when v_suspect then 'user_agent_pattern' else 'insufficient_signal' end, 0, false)
  on conflict (event_token) do nothing;
  if not found then return false; end if;
  return true;
end;
$$;

 then v_ref := null; end if;
  if (p_context->>'session_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}
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

 then
    v_session := (p_context->>'session_id')::uuid;
  end if;
  v_storage := case when p_context->>'storage_type' in ('localStorage','sessionStorage') then p_context->>'storage_type' end;
  v_status := case when p_context->>'visitor_id_status' in ('new','reused') then p_context->>'visitor_id_status' end;
  v_landing := left(p_context->>'landing_path',300);
  v_actual := left(p_context->>'page_path',300);
  if v_landing !~ '^/(?:food|editorial|cat-food-calculator|dog-food-calculator|guide|about|feed-registration)(?:/[[:alnum:]_%.-]+)*/?$|^/
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

 then v_landing := null; end if;
  if v_actual !~ '^/(?:food|editorial)(?:/[[:alnum:]_%.-]+)*/?
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

 then v_actual := null; end if;
  v_webdriver := p_context->'webdriver' = 'true'::jsonb;
  v_suspect := coalesce(v_webdriver,false) or coalesce(v_ua ~* '(bot|crawler|spider|headless|phantomjs|slurp|python-requests|curl/|wget/)',false);
  -- Serialize per visitor, including the 300/day cap.
  perform pg_advisory_xact_lock(hashtextextended(p_visitor_id::text, 0));
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


revoke all on function public.record_content_view_v2(uuid,text,text,text,text,uuid,jsonb) from public;
grant execute on function public.record_content_view_v2(uuid,text,text,text,text,uuid,jsonb) to anon,authenticated;

-- A random per-view capability permits bounded updates only to that view.
-- No raw IP, URL query, referrer URL, or interaction contents are collected.
create or replace function public.record_content_engagement(p_event_token uuid,p_seconds integer,p_interacted boolean)
returns boolean language plpgsql security definer set search_path = pg_catalog,public as $$
begin
  if p_event_token is null or p_seconds is null or p_seconds < 0 or p_seconds > 1800 then return false; end if;
  update public.content_view_events
  set engagement_seconds = greatest(engagement_seconds,p_seconds),
      interaction_observed = interaction_observed or coalesce(p_interacted,false),
      traffic_type = case when traffic_type = 'suspected_bot' then traffic_type
        when (interaction_observed or coalesce(p_interacted,false)) and greatest(engagement_seconds,p_seconds) >= 10 then 'human_estimated' else traffic_type end,
      classification_reason = case when traffic_type = 'suspected_bot' then classification_reason
        when (interaction_observed or coalesce(p_interacted,false)) and greatest(engagement_seconds,p_seconds) >= 10 then 'client_interaction_and_visible_10s' else classification_reason end
  where event_token = p_event_token and viewed_at > now() - interval '30 minutes'
    and p_seconds <= extract(epoch from now()-viewed_at)+5
    and (p_seconds > engagement_seconds or (coalesce(p_interacted,false) and not interaction_observed));
  return found;
end;
$$;
revoke all on function public.record_content_engagement(uuid,integer,boolean) from public;
grant execute on function public.record_content_engagement(uuid,integer,boolean) to anon,authenticated;

create or replace view public.content_view_log_kst with (security_invoker=true) as
select e.id, e.viewed_at at time zone 'Asia/Seoul' as viewed_at_kst,
  (e.viewed_at at time zone 'Asia/Seoul')::date as view_date_kst, e.visitor_id,
  row_number() over (partition by e.visitor_id order by e.viewed_at,e.id) as visitor_visit_order,
  e.content_type,e.content_title,e.content_path,e.content_key,e.previous_content_key,
  count(*) over (partition by e.content_key order by e.viewed_at,e.id) as cumulative_views,
  e.session_id,e.visitor_id_status,e.storage_type,e.user_agent,e.referrer_domain,e.landing_path,e.page_path,
  e.webdriver_reported,coalesce(e.traffic_type,'unknown') as traffic_type,
  coalesce(e.classification_reason,'legacy_no_diagnostics') as classification_reason,
  e.engagement_seconds,e.interaction_observed
from public.content_view_events e;
revoke all on public.content_view_log_kst from public,anon,authenticated;
comment on table public.content_view_events is 'Private analytics: pseudonymous browser IDs, bounded diagnostics, no raw IP or email. Bot/human classification is heuristic.';
