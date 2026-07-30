-- Helper migration to prevent duplicate saved pet profiles for the same user/species/name.
-- 적용 전 중복 pets 정리 필요: existing duplicate rows with the same user_id + species + name
-- must be merged or renamed before this constraint can be applied successfully.
ALTER TABLE public.pets
ADD CONSTRAINT pets_user_id_species_name_key
UNIQUE (user_id, species, name);
