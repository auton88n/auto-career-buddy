

# Expand Job Scanner: High-Volume Multi-Source Discovery

## Problem
The current scan-jobs edge function only runs 3 search queries with 10 results each, processes them sequentially, and caps AI extraction at 15 results. This yields ~2 jobs per scan.

## Solution Overview
Rewrite the scan-jobs edge function into an aggressive, parallelized multi-source scanner that generates dozens of search queries from title/location/job-board combinations, company career page searches, and processes everything in parallel batches. Also add a `target_locations` field to the profile so the user can specify multiple target cities.

---

## Step 1: Database Migration -- Add target_locations

Add a `target_locations` text array column to `user_profile` so the user can specify multiple locations (Riyadh, Dubai, Calgary, Toronto, Vancouver, Remote).

```sql
ALTER TABLE public.user_profile
  ADD COLUMN target_locations TEXT[] DEFAULT '{}'::text[];
```

Also fix the RLS policies that are still RESTRICTIVE (the previous migration may not have applied correctly):

```sql
-- Drop old restrictive policies and recreate as permissive for all 3 tables
```

## Step 2: Update Profile UI

Add a `target_locations` TagInput to the Profile page, similar to the existing target_titles field. Pre-populate suggestions or just let users type freely.

Update `saveProfile` and `loadProfile` to include the new field.

## Step 3: Rewrite scan-jobs Edge Function

This is the core change. The new architecture:

### 3a. Query Generation Engine

Generate search queries from combinations of:
- **Titles** (from profile): All target titles, no cap
- **Locations** (from profile): All target locations
- **Job board site-filters**: Append `site:greenhouse.io`, `site:lever.co`, `site:wellfound.com`, `site:glassdoor.com`, `site:bayt.com`, `site:naukrigulf.com`, `site:wuzzuf.com`, `site:gulftalent.com`, `site:workable.com`
- **Company career page queries**: For each company in the hardcoded lists (Saudi, UAE, Canada, Global), generate `"{company}" careers {title}` queries

Formula: Each title gets searched with each location, plus site-specific searches, plus company-specific searches. This produces 100+ queries.

### 3b. Parallel Search Execution

- Run Firecrawl searches in parallel batches of 5 concurrent requests
- Increase per-query limit from 10 to 20
- Remove the `slice(0, 3)` cap entirely
- Add error resilience: individual failures don't kill the scan
- Cap total queries at ~80 to stay within edge function time limits

### 3c. Batch AI Extraction

- Instead of sending only 15 results to AI, process ALL results in chunks of 20
- Each chunk gets its own AI extraction call
- Run extraction calls in parallel batches of 3

### 3d. Batch AI Scoring

- Instead of scoring jobs one-by-one (N API calls), batch 5-10 jobs per scoring call
- Use a structured tool call that returns an array of scores
- This reduces AI calls from ~50 individual calls to ~5-10 batch calls

### 3e. Keep All Existing Filters

- Blacklist check (unchanged)
- Company exclusion (unchanged)
- Duplicate hash detection (unchanged)
- Score threshold at 60 (unchanged)

### 3f. Edge Function Timeout

Set `wall_clock_limit` in config.toml to extend the timeout:

```toml
[functions.scan-jobs]
verify_jwt = false

[functions.scan-jobs.timeouts]
wall_clock_limit = 300
```

## Step 4: Update Response Stats

Update the scan result response to include more detail:
- `queries_run`: how many search queries were executed
- `raw_results`: total raw results from Firecrawl
- `jobs_extracted`: jobs parsed by AI
- `jobs_filtered`: after blacklist/exclusion
- `jobs_scored`: that passed scoring threshold
- `jobs_saved`: new unique jobs saved

Update the dashboard toast to show this richer info.

---

## Technical Details

### Hardcoded Company Lists (in edge function)

These are embedded as arrays in the edge function code and used to generate career-page-specific search queries:

- **Saudi Arabia**: Lucidya, MOZN, STC, stc pay, Noon, Careem, Jahez, Tamara, Tabby, Foodics, Lean Technologies, Devoteam ME, Raqmiyat, Master-Works, EyeGo, Micronisus, Inovasys, Qiddiya, NEOM, PIF, Saudi Aramco Digital, Elm, Taqnia, Bupa Arabia, Abdul Latif Jameel, stc Digital, Telfaz11, Unifonic, Hala, Sary, Rewaa, Nana, Zid, Salla
- **UAE**: Talabat, Careem, Binance, Deriv, Accenture UAE, ByteDance UAE, VaporVM, G42, Presight AI, e&, du Telecom, Majid Al Futtaim Tech, Noon UAE, Fetchr, Anghami, Dubizzle, Property Finder, Bayt, Kitopi, Deliveroo UAE, Pure Harvest, Sarwa, Stake, YAP, Ziina, Beehive, Bayut
- **Canada**: Shopify, Hootsuite, Benevity, Symend, Attabotics, Miovision, Absorb Software, Decisive Farming, Aislelabs, Vendasta, Helcim, Showpass, Neo Financial, Koho, Float, Coveo, Element AI alumni, Thinkific, Unbounce, Procurify
- **Global Remote AI**: Anthropic, OpenAI, Cohere, Scale AI, Hugging Face, Weights and Biases, Runway, Stability AI, Mistral, Perplexity, Together AI, Lovable, Vercel, Supabase, Replit, Cursor, Linear, Notion, Loom, Zapier, Make.com, Voiceflow

### Default Search Keywords (hardcoded fallback if profile titles are sparse)

AI Product Manager, Technical Product Manager, AI Platform Manager, AI Solutions Consultant, Full Stack Developer AI, LLM Engineer, AI Developer, Product Lead AI, Digital Transformation Manager, AI Consultant, AI Strategist, Product Owner AI, AI Applications Manager, Generative AI Product Manager

### Parallel Execution Helper

```text
async function runInBatches<T>(items: T[], batchSize: number, fn: (item: T) => Promise<any>): Promise<any[]> {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}
```

### Batch Scoring Tool Schema

Instead of scoring one job at a time, send 5-10 jobs and get all scores back:

```text
{
  name: "score_jobs_batch",
  parameters: {
    jobs: [{ index: number, score: number, reasoning: string }]
  }
}
```

### Files Changed

1. **New migration**: Add `target_locations` column + fix RLS policies
2. **src/pages/Profile.tsx**: Add target_locations TagInput, wire to save/load
3. **supabase/functions/scan-jobs/index.ts**: Complete rewrite with parallel multi-source scanning
4. **src/lib/api/jobs.ts**: Update ScanResult interface with new fields
5. **src/pages/Index.tsx**: Update toast to show richer scan stats
6. **supabase/config.toml**: Add timeout config for scan-jobs

