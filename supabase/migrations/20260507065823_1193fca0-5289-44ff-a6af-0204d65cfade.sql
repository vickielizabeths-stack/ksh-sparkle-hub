
-- 1. Recreate missing trigger for new auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. profiles: clean policy set
DROP POLICY IF EXISTS "profiles readable by authed" ON public.profiles;
DROP POLICY IF EXISTS "users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;

CREATE POLICY "profiles public read"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. user_roles: tidy duplicates
DROP POLICY IF EXISTS "allow insert for authenticated users" ON public.user_roles;
-- keep "users insert own non-admin role", "users see own roles", "admins manage roles", "admins see all roles"

-- 4. cleaner_profiles: tighten insert to own id only
DROP POLICY IF EXISTS "cleaner inserts own" ON public.cleaner_profiles;
CREATE POLICY "cleaner inserts own"
  ON public.cleaner_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
