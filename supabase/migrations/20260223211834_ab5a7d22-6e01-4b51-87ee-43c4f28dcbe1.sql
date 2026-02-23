
-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE for user_profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profile;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profile;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profile;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.user_profile;

CREATE POLICY "Users can view own profile" ON public.user_profile FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.user_profile FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.user_profile FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON public.user_profile FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE for job_listings
DROP POLICY IF EXISTS "Users can view own jobs" ON public.job_listings;
DROP POLICY IF EXISTS "Users can insert own jobs" ON public.job_listings;
DROP POLICY IF EXISTS "Users can update own jobs" ON public.job_listings;
DROP POLICY IF EXISTS "Users can delete own jobs" ON public.job_listings;

CREATE POLICY "Users can view own jobs" ON public.job_listings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON public.job_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.job_listings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own jobs" ON public.job_listings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE for applications
DROP POLICY IF EXISTS "Users can view own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can update own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can delete own applications" ON public.applications;

CREATE POLICY "Users can view own applications" ON public.applications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own applications" ON public.applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own applications" ON public.applications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own applications" ON public.applications FOR DELETE TO authenticated USING (auth.uid() = user_id);
