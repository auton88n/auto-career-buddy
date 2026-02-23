ALTER TABLE public.job_listings
  ADD COLUMN IF NOT EXISTS tailored_resume_text TEXT,
  ADD COLUMN IF NOT EXISTS cover_letter_text TEXT,
  ADD COLUMN IF NOT EXISTS apply_log JSONB DEFAULT '[]'::jsonb;