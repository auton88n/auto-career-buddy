

# Fix: Document Viewing, Scan Transparency, and Company Details

## Problems Identified

1. **Config.toml missing function entries** -- the `supabase/config.toml` only has the project ID, missing the `[functions.scan-jobs]` and `[functions.apply-jobs]` sections. This may cause JWT verification issues.
2. **Scan produces too few results** (only 2 jobs found) -- running 42 queries is overkill and slow. Reducing to fewer, smarter queries and guaranteeing the top 5 results will be faster and more reliable.
3. **No company details** -- the scan doesn't fetch company information. We need to use Firecrawl to scrape company "About" pages and summarize what they do.
4. **Document viewing works in code but hasn't been tested** -- the Batch Apply flow is synchronous and should work, but config issues may be blocking it.

---

## Changes

### 1. Fix `supabase/config.toml`

Add function configurations:

```
[functions.scan-jobs]
verify_jwt = false

[functions.apply-jobs]
verify_jwt = false
```

### 2. Optimize Scan -- Fewer Queries, Better Results, Company Details

**File: `supabase/functions/scan-jobs/index.ts`**

- Reduce from 42 queries down to ~12 focused queries (top 3 titles x 4 locations)
- Limit to best 5 jobs per scan (sorted by score descending)
- After scoring, use Firecrawl to scrape the company website for each top job and use Lovable AI to summarize what the company does
- Add a new `company_description` column to `job_listings` to store this info
- Add detailed console.log at every stage so you can see progress in edge function logs

### 3. Database Migration -- Add `company_description` Column

```sql
ALTER TABLE public.job_listings
  ADD COLUMN IF NOT EXISTS company_description TEXT;
```

### 4. Update Frontend -- Show Company Details and Fix Doc Viewing

**File: `src/pages/Index.tsx`**

- Add a "Company Info" column or expandable row that shows the company description
- Make sure the "View Documents" button also appears for jobs with status `applied` (not just `ready_to_apply`)
- Add a "Description" column or tooltip showing what the company does
- Keep the existing Print/Save PDF and Copy buttons

### 5. Update Types

**File: `src/integrations/supabase/types.ts`** -- add `company_description` to the job_listings type

**File: `src/lib/api/jobs.ts`** -- add `company_description` to the `JobListing` interface

---

## Scan Flow (Synchronous, Transparent)

1. User clicks "Scan Now"
2. Frontend shows progress banner: "Searching for jobs..."
3. Edge function runs 12 queries via Firecrawl (3 titles x 4 locations)
4. AI extracts and scores jobs
5. Top 5 by score are kept
6. For each top job, Firecrawl scrapes the company website and AI summarizes what they do
7. Jobs saved to database with company descriptions
8. Full results returned to frontend immediately with counts

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/config.toml` | Add function configs with verify_jwt = false |
| New migration SQL | Add `company_description` column |
| `supabase/functions/scan-jobs/index.ts` | Reduce to 12 queries, top 5 jobs, add company scraping |
| `src/pages/Index.tsx` | Show company description, ensure doc viewer works |
| `src/lib/api/jobs.ts` | Add `company_description` to interface |
| `src/integrations/supabase/types.ts` | Update types |

