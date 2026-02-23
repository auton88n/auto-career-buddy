

# AutoApply — Personal AI Job Application Agent

A single-user production app that automatically discovers relevant jobs via Firecrawl search, generates tailored ATS-friendly resumes and cover letters using AI, and manages your entire application pipeline.

---

## Phase 1: Foundation & Profile Setup

### Authentication
- Email/password login page (no signup flow — just your account)
- Protected routes redirecting unauthenticated users to login
- Sign-out in the header

### Database & Storage Setup
- **Tables**: `user_profile` (preferences, resume text, settings, blacklist), `job_listings` (company, title, URL, score, status, source, duplicate hash), `applications` (linked to job, PDF URLs, status, failure reason)
- **Storage**: Private `documents` bucket for resume uploads and generated PDFs
- **RLS**: All tables scoped to `auth.uid() = user_id`
- **Triggers**: Auto-create profile on signup, auto-update `updated_at` timestamps

### Profile & Preferences Page
- Form fields: target job titles (tags), industry preferences, location preference (remote/hybrid/onsite), minimum salary, experience level, key skills
- Companies to exclude list
- Keyword blacklist (auto-disqualifies jobs matching any keyword in title/description)
- Max applications per run setting (default 15)
- Master resume PDF upload → stored in Supabase Storage → text auto-extracted via edge function on upload and saved to `user_profile`

---

## Phase 2: Job Discovery Engine

### Firecrawl Search-Powered Discovery
- Edge function uses Firecrawl's search API to find jobs matching your profile criteria dynamically
- No hardcoded sources — searches the web based on your target titles, skills, and preferences

### Smart Filtering Pipeline
1. **Blacklist check** — instant discard if any keyword matches in title or description
2. **Duplicate detection** — hash of company + title + location, skip if already exists
3. **AI Scoring** (Gemini 2.5 Flash via Lovable AI gateway):
   - Role match (30pts), Remote preference (20pts), Salary match (15pts), Skills match (20pts), Company fit (15pts)
   - Only jobs scoring **80+** are saved with status `pending`

---

## Phase 3: AI Resume & Cover Letter Generation

### Tailored Resume
- Takes your master resume text + the specific job description
- Gemini 2.5 Flash rewrites it to match ATS keywords from the posting
- Constraints: one page, single-column, plain text layout, Arial/Times New Roman
- Generated as HTML → converted to PDF server-side in an edge function → saved to Supabase Storage

### Tailored Cover Letter
- Professional, human-sounding letter specific to company and role
- References specifics from the job description
- One page, same clean ATS-friendly HTML-to-PDF format
- Saved to Supabase Storage

---

## Phase 4: Dashboard

### Overview Stats
- Cards showing: total jobs found, applied, pending, manual required
- Visual chart of application activity over time

### Job List View
- Sortable/filterable table: company, title, score, status, date, link to posting
- **Pending jobs**: preview tailored resume & cover letter, with Approve and Skip buttons
- **Manual required jobs**: highlighted with failure reason displayed

### Actions
- Manual "Scan Now" button to trigger job discovery on demand
- Approve/skip workflow for pending applications

---

## Phase 5: Automated Application (Orgo — Placeholder)
- UI and data model ready for Orgo integration
- Status tracking for `applied` vs `manual_required` with failure reasons
- Max applications per run enforcement
- Actual Orgo API calls to be wired in once documentation is available

---

## Phase 6: Nightly Automation

### Scheduled Cron Job (2am nightly)
- Scan job sources via Firecrawl search
- Score, filter, and save qualifying jobs
- Generate tailored resumes and cover letters for qualifying jobs
- Log a summary of the run
- Orgo auto-apply step ready to enable once integrated

---

## Design
- Clean, minimal dark-mode UI
- Inter font for UI, JetBrains Mono for code/stats
- Sticky header with nav (Dashboard, Profile) and sign-out button
- Status colors: green (success/applied), amber (warning/manual), blue (accent/pending)

