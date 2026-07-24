-- Helper migration to prevent duplicate saved cat profiles for the same user/name pair.
-- 적용 전 중복 cats 정리 필요: existing duplicate rows with the same user_id + name
-- must be merged or renamed before this constraint can be applied successfully.
ALTER TABLE public.cats
ADD CONSTRAINT cats_user_id_name_key
UNIQUE (user_id, name);
