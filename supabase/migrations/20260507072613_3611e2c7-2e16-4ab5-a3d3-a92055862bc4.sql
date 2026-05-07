
ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS completed_jobs integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_completed_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'::public.booking_status
     AND (OLD.status IS DISTINCT FROM 'completed'::public.booking_status) THEN
    UPDATE public.cleaner_profiles
       SET completed_jobs = completed_jobs + 1
     WHERE id = NEW.cleaner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_bump_jobs ON public.bookings;
CREATE TRIGGER bookings_bump_jobs
AFTER UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.bump_completed_jobs();
