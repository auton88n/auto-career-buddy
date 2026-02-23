

# Phase 3: Auto-Apply (Lovable AI Only) + Scan Fix

Two changes in one:

---

## Part A: Fix Scan to Guarantee 10+ High-Score Jobs

**Problem**: The background scan runs many queries but the score threshold (60) and deduplication mean you often see very few results. Since it runs in the background, you can't tell what happened.

**Solution**: Lower the score threshold to 40 and guarantee at least 10 jobs are saved per scan by keeping the top 10 by score even if they fall below threshold. Also add a progress log so you can see what's happening.

### Changes to `supabase/functions/scan-jobs/index.ts`:
- After scoring, sort all scored jobs by score descending
- If fewer than 10 pass the threshold (60), backfill from remaining jobs down to score 40
- Always save at least `min(10, total_scored_jobs)` jobs
- Add console logs at each stage for debugging

---

## Part B: Auto-Apply with Lovable AI (Document Generation Only)

Since you don't have Orgo/Gemini keys yet, this phase will:
1. Generate a **tailored resume** and **cover letter** for each approved job using Lovable AI
2. Store the generated documents
3. Open the job URL so you can manually submit with the generated docs

### Step 1: Database Migration

Add columns to `job_listings` (simpler than creating a separate applications table):

```sql
ALTER TABLE public.job_listings
  ADD COLUMN IF NOT EXISTS tailored_resume_text TEXT,
  ADD COLUMN IF NOT EXISTS cover_letter_text TEXT,
  ADD COLUMN IF NOT EXISTS apply_log JSONB DEFAULT '[]'::jsonb;
```

### Step 2: New Edge Function -- `apply-jobs`

Create `supabase/functions/apply-jobs/index.ts`:

- Accepts POST with optional `{ job_ids: string[] }`
- Defaults to all jobs with status = "approved"
- Authenticates user via Authorization header
- Returns immediately, processes in background via `EdgeRuntime.waitUntil()`
- For each approved job:
  1. Update status to `generating_docs`
  2. Fetch user profile (resume_text, skills, target_titles, notes)
  3. Call Lovable AI (`google/gemini-3-flash-preview`) with tool calling to generate:
     - Tailored resume text (restructured for the specific job)
     - Cover letter text (personalized for company + role)
  4. Save `tailored_resume_text` and `cover_letter_text` to the job row
  5. Update status to `ready_to_apply`
  6. Log each step in `apply_log` JSONB
- On failure: set status to `failed`, log error
- Respects `max_applications_per_run` from profile

### Step 3: Frontend Updates

**Dashboard (`src/pages/Index.tsx`)**:
- Add "Batch Apply" button next to "Scan Now" (shows count of approved jobs)
- New status badges: `generating_docs` (blue), `ready_to_apply` (green), `failed` (red)
- Polling after clicking (same 15-second pattern as scan)
- For `ready_to_apply` jobs: show buttons to view generated resume/cover letter and open the job URL

**API layer (`src/lib/api/jobs.ts`)**:
- Add `applyToJobs(jobIds?: string[])` method
- Add `getApplicationDocs(jobId: string)` to fetch generated text
- Update `getJobCounts()` to include new statuses

**New Dialog Component**:
- "View Documents" dialog that shows the AI-generated resume and cover letter for a job
- Copy-to-clipboard buttons for easy pasting into application forms

### Step 4: Config

Add to `supabase/config.toml`:
```text
[functions.apply-jobs]
verify_jwt = false
```

---

## Files Changed

| File | Change |
|------|--------|
| New migration SQL | Add 3 columns to `job_listings` |
| `supabase/functions/scan-jobs/index.ts` | Lower threshold, guarantee 10 jobs minimum |
| `supabase/functions/apply-jobs/index.ts` | New edge function for doc generation |
| `src/pages/Index.tsx` | Batch Apply button, new badges, doc viewer dialog |
| `src/lib/api/jobs.ts` | New methods + updated types |
| `supabase/config.toml` | Add apply-jobs config |

## No Extra API Keys Needed

Everything uses the existing `LOVABLE_API_KEY` (auto-provisioned). When you later get Orgo + Gemini keys, we can add the browser automation layer on top.

