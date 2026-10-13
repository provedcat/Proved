-- Aggregate anonymous, zero-result food searches by Korea-local date.
-- No IP address, session identifier, user id or email is stored.
create table if not exists public.food_zero_result_searches (
  id bigint generated always as identity primary key,
  search_day date not null default (timezone('Asia/Seoul', now()))::date,
  search_query text not null check (char_length(search_query) between 3 and 120),
  species text not null check (species in ('all', 'cat', 'dog')),
  feed_type text not null check (feed_type in ('all', 'dry', 'wet')),
  role text not null check (role in ('all', '주식', '보조식')),
  tag_count smallint not null default 0 check (tag_count between 0 and 20),
  suggestion_count smallint not null default 0 check (suggestion_count between 0 and 3),
  occurrences integer not null default 1 check (occurrences > 0),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (search_day, search_query, species, feed_type, role, tag_count)
);

comment on table public.food_zero_result_searches is
  'Daily aggregate of anonymous zero-result product searches; only sanitized search terms and filter context are retained.';

create index if not exists food_zero_result_searches_recent_idx
  on public.food_zero_result_searches (last_seen desc);

alter table public.food_zero_result_searches enable row level security;
revoke all on public.food_zero_result_searches from public, anon, authenticated;
grant select on public.food_zero_result_searches to service_role;

create or replace function public.record_food_zero_result_search(
  p_query text,
  p_species text default 'all',
  p_feed_type text default 'all',
  p_role text default 'all',
  p_tag_count integer default 0,
  p_suggestion_count integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_query text;
begin
  normalized_query := lower(btrim(regexp_replace(coalesce(p_query, ''), '[[:space:]]+', ' ', 'g')));

  -- Drop empty, extremely long, numeric-only, URL, email and phone-number inputs.
  if char_length(normalized_query) not between 3 and 120
     or normalized_query !~ '[[:alpha:]]'
     or normalized_query ~* '(https?://|www[.]|[[:alnum:]_.%+-]+@[[:alnum:].-]+[.][a-z]{2,})'
     or normalized_query ~ '(^|[^0-9])01[016789][ -]?[0-9]{3,4}[ -]?[0-9]{4}($|[^0-9])'
     or p_species not in ('all', 'cat', 'dog')
     or p_feed_type not in ('all', 'dry', 'wet')
     or p_role not in ('all', '주식', '보조식')
     or coalesce(p_tag_count, -1) not between 0 and 20
     or coalesce(p_suggestion_count, -1) not between 0 and 3
  then
    return;
  end if;

  insert into public.food_zero_result_searches (
    search_day, search_query, species, feed_type, role, tag_count, suggestion_count
  ) values (
    (timezone('Asia/Seoul', now()))::date,
    normalized_query, p_species, p_feed_type, p_role, p_tag_count, p_suggestion_count
  )
  on conflict (search_day, search_query, species, feed_type, role, tag_count)
  do update set
    occurrences = public.food_zero_result_searches.occurrences + 1,
    last_seen = now(),
    suggestion_count = greatest(public.food_zero_result_searches.suggestion_count, excluded.suggestion_count);
end;
$$;

revoke all on function public.record_food_zero_result_search(text, text, text, text, integer, integer) from public;
grant execute on function public.record_food_zero_result_search(text, text, text, text, integer, integer)
  to anon, authenticated, service_role;

-- Reporting example:
-- select search_query, sum(occurrences) attempts, max(last_seen) last_seen
-- from public.food_zero_result_searches
-- group by search_query order by attempts desc, last_seen desc limit 50;
