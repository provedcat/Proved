-- Prevent ingredient names such as "chicken liver" from being classified as
-- liver-management products. The hepatic management tag now requires an
-- explicit management-purpose expression rather than the word "liver" alone.

DO $migration$
DECLARE
  function_name text;
  function_sql text;
  old_pattern constant text := '(hepatic|liver|간 건강|간질환|헤파틱)';
  new_pattern constant text := '(hepatic|헤파틱|간[[:space:]]*(영양[[:space:]]*)?(건강|질환|케어|관리|기능|보조)|liver[[:space:]-]*(care|health|support|disease|diet|function))';
BEGIN
  FOREACH function_name IN ARRAY ARRAY['auto_tag_feed_row', 'backfill_food_tags_core']
  LOOP
    SELECT pg_get_functiondef(p.oid)
      INTO function_sql
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = function_name
      AND p.prokind = 'f'
      AND p.pronargs = 0;

    IF function_sql IS NULL THEN
      RAISE EXCEPTION 'Required tagging function public.%() not found', function_name;
    END IF;

    IF position(old_pattern IN function_sql) = 0 THEN
      RAISE EXCEPTION 'Expected hepatic matcher not found in public.%()', function_name;
    END IF;

    function_sql := replace(function_sql, old_pattern, new_pattern);
    EXECUTE function_sql;
  END LOOP;
END
$migration$;

-- Remove existing automatically-derived false positives while preserving manual
-- mappings and any product that explicitly claims a liver-management purpose.
WITH hepatic AS (
  SELECT id
  FROM public.food_tags
  WHERE slug = 'hepatic'
)
DELETE FROM public.feed_food_tags mapping
USING hepatic tag, public.feeds feed
WHERE mapping.tag_id = tag.id
  AND mapping.feed_id = feed.id
  AND mapping.source <> 'manual'
  AND lower(concat_ws(
        ' ',
        feed."제조사",
        feed."제품명",
        feed."완전식여부",
        to_jsonb(feed)->>'description',
        to_jsonb(feed)->>'제품설명'
      )) !~ '(hepatic|헤파틱|간[[:space:]]*(영양[[:space:]]*)?(건강|질환|케어|관리|기능|보조)|liver[[:space:]-]*(care|health|support|disease|diet|function))';

WITH hepatic AS (
  SELECT id
  FROM public.food_tags
  WHERE slug = 'hepatic'
)
DELETE FROM public.dog_feed_food_tags mapping
USING hepatic tag, public.dog_feeds feed
WHERE mapping.tag_id = tag.id
  AND mapping.dog_feed_id = feed.id
  AND mapping.source <> 'manual'
  AND lower(concat_ws(
        ' ',
        feed."제조사",
        feed."제품명",
        feed."완전식여부",
        to_jsonb(feed)->>'description',
        to_jsonb(feed)->>'제품설명'
      )) !~ '(hepatic|헤파틱|간[[:space:]]*(영양[[:space:]]*)?(건강|질환|케어|관리|기능|보조)|liver[[:space:]-]*(care|health|support|disease|diet|function))';
