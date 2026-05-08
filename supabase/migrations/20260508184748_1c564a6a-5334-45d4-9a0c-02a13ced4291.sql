DELETE FROM public.cleaner_categories WHERE cleaner_id::text LIKE '11111111-%';
DELETE FROM public.ratings WHERE cleaner_id::text LIKE '11111111-%';
DELETE FROM public.bookings WHERE cleaner_id::text LIKE '11111111-%';
DELETE FROM public.cleaner_profiles WHERE id::text LIKE '11111111-%';
DELETE FROM public.profiles WHERE id::text LIKE '11111111-%';