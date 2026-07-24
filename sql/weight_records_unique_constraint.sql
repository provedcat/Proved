-- Ensure one weight entry per cat per day so Supabase upsert({ onConflict: 'cat_id,recorded_date' })
-- can update the daily weight instead of inserting duplicates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'weight_records_cat_id_recorded_date_key'
  ) THEN
    ALTER TABLE public.weight_records
      ADD CONSTRAINT weight_records_cat_id_recorded_date_key
      UNIQUE (cat_id, recorded_date);
  END IF;
END $$;
