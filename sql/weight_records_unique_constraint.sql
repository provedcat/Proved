-- Ensure one weight entry per pet per day so Supabase upsert({ onConflict: 'pet_id,recorded_date' })
-- can update the daily weight instead of inserting duplicates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'weight_records_pet_id_recorded_date_key'
  ) THEN
    ALTER TABLE public.weight_records
      ADD CONSTRAINT weight_records_pet_id_recorded_date_key
      UNIQUE (pet_id, recorded_date);
  END IF;
END $$;
