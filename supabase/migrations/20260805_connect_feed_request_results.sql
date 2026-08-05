-- Apps Script 직접 등록 결과를 feed_requests 행에 연결합니다.
-- 브라우저에는 테이블 INSERT 권한을 열지 않고, 검증된 RPC만 허용합니다.

alter table public.feed_requests
  add column if not exists target_table text,
  add column if not exists registered_feed_id uuid,
  add column if not exists error_message text,
  add column if not exists result_summary text,
  add column if not exists research_data jsonb not null default '{}'::jsonb;

-- Backward-compatible result columns used by the current production Apps Script
-- and older admin views. Keep these populated with the same final outcome so
-- feed_requests remains a result ledger rather than the destination table.
alter table public.feed_requests
  add column if not exists result_table text,
  add column if not exists result_feed_ids uuid[] not null default '{}'::uuid[],
  add column if not exists error_detail text;

alter table public.feed_requests
  drop constraint if exists feed_requests_status_check;

alter table public.feed_requests
  add constraint feed_requests_status_check
  check (status in ('pending', 'registered', 'needs_review', 'duplicate', 'failed'));

alter table public.feed_requests
  drop constraint if exists feed_requests_target_table_check;
alter table public.feed_requests
  drop constraint if exists feed_requests_result_table_check;

alter table public.feed_requests
  add constraint feed_requests_target_table_check
  check (target_table is null or target_table in ('feeds', 'dog_feeds'));
alter table public.feed_requests
  add constraint feed_requests_result_table_check
  check (result_table is null or result_table in ('feeds', 'dog_feeds'));

create or replace function public.sync_feed_request_result_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $sync_feed_request_result_columns$
begin
  if new.target_table is null and new.result_table is not null then
    new.target_table := new.result_table;
  elsif new.result_table is null and new.target_table is not null then
    new.result_table := new.target_table;
  end if;

  if new.registered_feed_id is null and array_length(new.result_feed_ids, 1) >= 1 then
    new.registered_feed_id := new.result_feed_ids[1];
  elsif new.registered_feed_id is not null and (new.result_feed_ids is null or array_length(new.result_feed_ids, 1) is null) then
    new.result_feed_ids := array[new.registered_feed_id];
  end if;

  if new.error_message is null and new.error_detail is not null then
    new.error_message := new.error_detail;
  elsif new.error_detail is null and new.error_message is not null then
    new.error_detail := new.error_message;
  end if;

  if new.processed_at is null and new.status in ('registered', 'duplicate', 'failed') then
    new.processed_at := now();
  end if;

  return new;
end;
$sync_feed_request_result_columns$;

drop trigger if exists sync_feed_request_result_columns_trigger on public.feed_requests;
create trigger sync_feed_request_result_columns_trigger
before insert or update of target_table, result_table, registered_feed_id, result_feed_ids, error_message, error_detail, status
on public.feed_requests
for each row execute function public.sync_feed_request_result_columns();

create or replace function public.create_feed_request(
  p_request_text text,
  p_species text,
  p_feed_type text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $create_feed_request$
declare
  new_request_id uuid;
  normalized_request_text text := btrim(p_request_text);
begin
  if char_length(normalized_request_text) not between 2 and 120 then
    raise exception 'request_text must be between 2 and 120 characters';
  end if;

  if p_species not in ('cat', 'dog') then
    raise exception 'species must be cat or dog';
  end if;

  if p_feed_type not in ('dry', 'wet') then
    raise exception 'feed_type must be dry or wet';
  end if;

  insert into public.feed_requests (request_text, species, feed_type, user_id)
  values (normalized_request_text, p_species, p_feed_type, auth.uid())
  returning id into new_request_id;

  return new_request_id;
end;
$create_feed_request$;

revoke all on function public.create_feed_request(text, text, text) from public;
grant execute on function public.create_feed_request(text, text, text) to anon, authenticated;

comment on function public.create_feed_request(text, text, text) is
  'Creates a validated feed request ledger row and returns its ID for Apps Script result updates.';
