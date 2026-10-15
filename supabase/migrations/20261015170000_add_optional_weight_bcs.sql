-- Optional BCS (1-9) on existing per-pet, per-day weight records.
-- NULL means the user did not assess BCS on that date.
alter table public.weight_records
  add column if not exists bcs_score smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.weight_records'::regclass
      and conname = 'weight_records_bcs_score_range'
  ) then
    alter table public.weight_records
      add constraint weight_records_bcs_score_range
      check (bcs_score is null or bcs_score between 1 and 9);
  end if;
end $$;
