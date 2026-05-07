-- Update handle_new_user to honor an intended role from signup metadata
-- so a single signup flow can register either a customer or a cleaner.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  intended_role public.app_role;
BEGIN
  -- Read intended role from signup metadata; default to customer.
  intended_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role,
    'customer'::public.app_role
  );
  -- Never allow self-elevation to admin via signup metadata.
  IF intended_role = 'admin'::public.app_role THEN
    intended_role := 'customer'::public.app_role;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, national_id, date_of_birth)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'national_id',
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, intended_role)
  ON CONFLICT DO NOTHING;

  -- Pre-create a pending cleaner profile so the application appears in the
  -- admin queue as soon as the cleaner finishes onboarding details.
  IF intended_role = 'cleaner'::public.app_role THEN
    INSERT INTO public.cleaner_profiles (id, status)
    VALUES (NEW.id, 'pending'::public.cleaner_status)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;