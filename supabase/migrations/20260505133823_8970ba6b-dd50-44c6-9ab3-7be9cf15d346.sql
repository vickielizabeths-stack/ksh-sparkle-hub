
-- Roles
CREATE TYPE public.app_role AS ENUM ('customer', 'cleaner', 'admin');
CREATE TYPE public.cleaner_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.booking_status AS ENUM ('pending', 'accepted', 'declined', 'completed', 'cancelled');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins see all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authed" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile + default customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Service categories
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.service_categories FOR SELECT USING (true);
CREATE POLICY "admins manage categories" ON public.service_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.service_categories (name, description, icon) VALUES
  ('Home Cleaning', 'Standard residential cleaning', 'Home'),
  ('Deep Cleaning', 'Thorough top-to-bottom cleaning', 'Sparkles'),
  ('Office Cleaning', 'Workspaces and commercial', 'Building2'),
  ('Move In/Out', 'Cleaning for moving day', 'Truck'),
  ('Post-Construction', 'After renovation cleanup', 'HardHat'),
  ('Laundry & Ironing', 'Wash, dry, iron, fold', 'Shirt');

-- Cleaner profiles
CREATE TABLE public.cleaner_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bio TEXT,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 500,
  location TEXT,
  years_experience INT NOT NULL DEFAULT 0,
  avatar_url TEXT,
  status cleaner_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cleaner_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approved cleaners public" ON public.cleaner_profiles FOR SELECT USING (status = 'approved');
CREATE POLICY "cleaner sees own" ON public.cleaner_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "admin sees all cleaners" ON public.cleaner_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cleaner inserts own" ON public.cleaner_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "cleaner updates own" ON public.cleaner_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "admin updates cleaners" ON public.cleaner_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Cleaner ↔ category
CREATE TABLE public.cleaner_categories (
  cleaner_id UUID NOT NULL REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (cleaner_id, category_id)
);
ALTER TABLE public.cleaner_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cleaner_categories public read" ON public.cleaner_categories FOR SELECT USING (true);
CREATE POLICY "cleaner manages own categories" ON public.cleaner_categories FOR ALL TO authenticated USING (auth.uid() = cleaner_id) WITH CHECK (auth.uid() = cleaner_id);

-- Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cleaner_id UUID NOT NULL REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.service_categories(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  hours NUMERIC(4,2) NOT NULL DEFAULT 2,
  total_price NUMERIC(10,2) NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer sees own bookings" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "cleaner sees own bookings" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = cleaner_id);
CREATE POLICY "admin sees all bookings" ON public.bookings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "customer creates bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "customer updates own bookings" ON public.bookings FOR UPDATE TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "cleaner updates own bookings" ON public.bookings FOR UPDATE TO authenticated USING (auth.uid() = cleaner_id);

-- Ratings
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cleaner_id UUID NOT NULL REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  stars INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings public read" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "customer creates own rating" ON public.ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cleaner_profiles_updated BEFORE UPDATE ON public.cleaner_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
