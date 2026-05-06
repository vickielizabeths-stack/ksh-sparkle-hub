-- Allow users to insert their own non-admin role (e.g. when applying as a cleaner)
CREATE POLICY "users insert own non-admin role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role IN ('customer'::app_role, 'cleaner'::app_role));