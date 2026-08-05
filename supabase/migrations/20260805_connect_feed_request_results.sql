-- Apps Script 직접 등록 결과를 feed_requests 행에 연결합니다.
-- 브라우저에는 테이블 INSERT 권한을 열지 않고, 검증된 RPC만 허용합니다.

alter table public.feed_requests
  add column if not exists target_table text,
  add column if not exists registered_feed_id uuid,
  add column if not exists error_message text,
  add column if not exists result_summary text;

alter table public.feed_requests
  drop constraint if exists feed_requests_status_check;

alter table public.feed_requests
  add constraint feed_requests_status_check
  check (status in ('pending', 'registered', 'needs_review', 'duplicate', 'failed'));

alter table public.feed_requests
  drop constraint if exists feed_requests_target_table_check;

alter table public.feed_requests
  add constraint feed_requests_target_table_check
  check (target_table is null or target_table in ('feeds', 'dog_feeds'));

create or replace function public.create_feed_request(
  p_request_text text,
  p_species text,
  p_feed_type text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

revoke all on function public.create_feed_request(text, text, text) from public;
grant execute on function public.create_feed_request(text, text, text) to anon, authenticated;

comment on function public.create_feed_request(text, text, text) is
  'Creates a validated feed request ledger row and returns its ID for Apps Script result updates.';
