alter table public.feeds
  add column if not exists verification_status text,
  add column if not exists searchable_before_review boolean not null default false,
  add column if not exists submission_method text,
  add column if not exists requested_query text,
  add column if not exists source_urls jsonb not null default '[]'::jsonb,
  add column if not exists source_level text,
  add column if not exists source_region text,
  add column if not exists formula_match_status text,
  add column if not exists ai_review_note text,
  add column if not exists needs_nutrition_review boolean not null default false;

alter table public.dog_feeds
  add column if not exists verification_status text,
  add column if not exists searchable_before_review boolean not null default false,
  add column if not exists submission_method text,
  add column if not exists requested_query text,
  add column if not exists source_urls jsonb not null default '[]'::jsonb,
  add column if not exists source_level text,
  add column if not exists source_region text,
  add column if not exists formula_match_status text,
  add column if not exists ai_review_note text,
  add column if not exists needs_nutrition_review boolean not null default false;

alter table public.feeds drop constraint if exists feeds_verification_status_check;
alter table public.feeds add constraint feeds_verification_status_check
  check (verification_status is null or verification_status in ('pending_review','needs_label','conflict','approved','rejected'));
alter table public.feeds drop constraint if exists feeds_submission_method_check;
alter table public.feeds add constraint feeds_submission_method_check
  check (submission_method is null or submission_method in ('photo','text_request','admin_bulk','unknown'));
alter table public.feeds drop constraint if exists feeds_formula_match_status_check;
alter table public.feeds add constraint feeds_formula_match_status_check
  check (formula_match_status is null or formula_match_status in ('same','different','unknown'));

alter table public.dog_feeds drop constraint if exists dog_feeds_verification_status_check;
alter table public.dog_feeds add constraint dog_feeds_verification_status_check
  check (verification_status is null or verification_status in ('pending_review','needs_label','conflict','approved','rejected'));
alter table public.dog_feeds drop constraint if exists dog_feeds_submission_method_check;
alter table public.dog_feeds add constraint dog_feeds_submission_method_check
  check (submission_method is null or submission_method in ('photo','text_request','admin_bulk','unknown'));
alter table public.dog_feeds drop constraint if exists dog_feeds_formula_match_status_check;
alter table public.dog_feeds add constraint dog_feeds_formula_match_status_check
  check (formula_match_status is null or formula_match_status in ('same','different','unknown'));

create or replace function public.set_feed_review_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.verified is true then
    new.verification_status := 'approved';
    new.searchable_before_review := false;
    if new.submission_method is null then
      new.submission_method := case when new.uploaded_by = 'admin' then 'admin_bulk' else 'unknown' end;
    end if;
    return new;
  end if;

  if new.submission_method is null then
    new.submission_method := case
      when new.requested_query is not null then 'text_request'
      when new.image_url is not null then 'photo'
      else 'unknown'
    end;
  end if;

  if new.verification_status is null or new.verification_status = 'approved' then
    new.verification_status := 'pending_review';
  end if;

  new.searchable_before_review :=
    coalesce(new.final_me, 0) > 0
    and new.verification_status in ('pending_review', 'needs_label');

  return new;
end;
$$;

drop trigger if exists set_feed_review_state_trigger on public.feeds;
create trigger set_feed_review_state_trigger
before insert or update of verified, verification_status, final_me, submission_method, requested_query, image_url
on public.feeds
for each row execute function public.set_feed_review_state();

drop trigger if exists set_dog_feed_review_state_trigger on public.dog_feeds;
create trigger set_dog_feed_review_state_trigger
before insert or update of verified, verification_status, final_me, submission_method, requested_query, image_url
on public.dog_feeds
for each row execute function public.set_feed_review_state();

update public.feeds
set verification_status = case when verified then 'approved' else 'pending_review' end,
    searchable_before_review = false,
    submission_method = case
      when verified and uploaded_by = 'admin' then 'admin_bulk'
      when not verified and image_url is not null then 'photo'
      else coalesce(submission_method, 'unknown')
    end
where verification_status is null;

update public.dog_feeds
set verification_status = case when verified then 'approved' else 'pending_review' end,
    searchable_before_review = false,
    submission_method = case
      when verified and uploaded_by = 'admin' then 'admin_bulk'
      when not verified and image_url is not null then 'photo'
      else coalesce(submission_method, 'unknown')
    end
where verification_status is null;

create index if not exists feeds_provisional_search_idx
  on public.feeds (type, searchable_before_review)
  where verified is false;
create index if not exists dog_feeds_provisional_search_idx
  on public.dog_feeds (type, searchable_before_review)
  where verified is false;
