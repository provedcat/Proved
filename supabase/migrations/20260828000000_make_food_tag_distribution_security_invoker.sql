-- Ensure the public tag-distribution view respects the caller's RLS context.
alter view public.food_tag_distribution set (security_invoker = true);
