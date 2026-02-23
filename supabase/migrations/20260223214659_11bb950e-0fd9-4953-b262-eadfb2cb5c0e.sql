
-- Add target_locations column
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS target_locations TEXT[] DEFAULT '{}'::text[];

-- Fix RLS policies: Drop restrictive and recreate as permissive

-- user_profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profile;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profile;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profile;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.user_profile;

CREATE POLICY "Users can view own profile" ON public.user_profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.user_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.user_profile FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON public.user_profile FOR DELETE USING (auth.uid() = user_id);

-- job_listings
DROP POLICY IF EXISTS "Users can view own jobs" ON public.job_listings;
DROP POLICY IF EXISTS "Users can insert own jobs" ON public.job_listings;
DROP POLICY IF EXISTS "Users can update own jobs" ON public.job_listings;
DROP POLICY IF EXISTS "Users can delete own jobs" ON public.job_listings;

CREATE POLICY "Users can view own jobs" ON public.job_listings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON public.job_listings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.job_listings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own jobs" ON public.job_listings FOR DELETE USING (auth.uid() = user_id);

-- applications
DROP POLICY IF EXISTS "Users can view own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can update own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can delete own applications" ON public.applications;

CREATE POLICY "Users can view own applications" ON public.applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own applications" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own applications" ON public.applications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own applications" ON public.applications FOR DELETE USING (auth.uid() = user_id);
