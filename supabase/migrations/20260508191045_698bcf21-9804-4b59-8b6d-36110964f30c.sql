-- Remove orphaned cleaner_profiles whose auth user was deleted
DELETE FROM public.cleaner_categories
 WHERE cleaner_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.ratings
 WHERE cleaner_id NOT IN (SELECT id FROM auth.users)
    OR customer_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.bookings
 WHERE cleaner_id NOT IN (SELECT id FROM auth.users)
    OR customer_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.cleaner_profiles
 WHERE id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.profiles
 WHERE id NOT IN (SELECT id FROM auth.users);

-- Backfill missing cleaner role for surviving cleaner_profiles
INSERT INTO public.user_roles (user_id, role)
SELECT cp.id, 'cleaner'::public.app_role
FROM public.cleaner_profiles cp
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = cp.id AND ur.role = 'cleaner'::public.app_role
)
ON CONFLICT DO NOTHING;