import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Company lists for career-page queries ──
const COMPANIES_SAUDI = ["Lucidya","MOZN","STC","stc pay","Noon","Careem","Jahez","Tamara","Tabby","Foodics","Lean Technologies","Devoteam ME","Raqmiyat","Master-Works","EyeGo","Micronisus","Inovasys","Qiddiya","NEOM","PIF","Saudi Aramco Digital","Elm","Taqnia","Bupa Arabia","Abdul Latif Jameel","stc Digital","Telfaz11","Unifonic","Hala","Sary","Rewaa","Nana","Zid","Salla"];
const COMPANIES_UAE = ["Talabat","Careem","Binance","Deriv","Accenture UAE","ByteDance UAE","VaporVM","G42","Presight AI","e&","du Telecom","Majid Al Futtaim Tech","Noon UAE","Fetchr","Anghami","Dubizzle","Property Finder","Bayt","Kitopi","Deliveroo UAE","Pure Harvest","Sarwa","Stake","YAP","Ziina","Beehive","Bayut"];
const COMPANIES_CANADA = ["Shopify","Hootsuite","Benevity","Symend","Attabotics","Miovision","Absorb Software","Decisive Farming","Aislelabs","Vendasta","Helcim","Showpass","Neo Financial","Koho","Float","Coveo","Thinkific","Unbounce","Procurify"];
const COMPANIES_GLOBAL = ["Anthropic","OpenAI","Cohere","Scale AI","Hugging Face","Weights and Biases","Runway","Stability AI","Mistral","Perplexity","Together AI","Lovable","Vercel","Supabase","Replit","Cursor","Linear","Notion","Loom","Zapier","Make.com","Voiceflow"];
const ALL_COMPANIES = [...COMPANIES_SAUDI, ...COMPANIES_UAE, ...COMPANIES_CANADA, ...COMPANIES_GLOBAL];

const JOB_BOARD_SITES = [
  "site:greenhouse.io","site:lever.co","site:wellfound.com","site:glassdoor.com",
  "site:bayt.com","site:naukrigulf.com","site:wuzzuf.com","site:gulftalent.com","site:workable.com",
];

const DEFAULT_TITLES = [
  "AI Product Manager","Technical Product Manager","AI Platform Manager","AI Solutions Consultant",
  "Full Stack Developer AI","LLM Engineer","AI Developer","Product Lead AI",
  "Digital Transformation Manager","AI Consultant","AI Strategist","Product Owner AI",
  "AI Applications Manager","Generative AI Product Manager",
];

const DEFAULT_LOCATIONS = ["Riyadh Saudi Arabia","Dubai UAE","Abu Dhabi UAE","Calgary Canada","Toronto Canada","Vancouver Canada","Remote"];

// ── Helpers ──
async function runInBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

function generateQueries(titles: string[], locations: string[]): string[] {
  const queries: string[] = [];

  // Title x Location combinations
  for (const title of titles) {
    for (const loc of locations) {
      queries.push(`${title} ${loc} job`);
    }
  }

  // Title x Job board site filters (pick first 3 titles to keep count reasonable)
  const topTitles = titles.slice(0, 4);
  for (const title of topTitles) {
    for (const site of JOB_BOARD_SITES) {
      queries.push(`${title} ${site}`);
    }
  }

  // Company career page queries (sample companies to stay within limits)
  const sampledCompanies = ALL_COMPANIES.sort(() => Math.random() - 0.5).slice(0, 20);
  const mainTitle = titles[0] || "Product Manager";
  for (const company of sampledCompanies) {
    queries.push(`"${company}" careers ${mainTitle}`);
  }

  // Cap at 80 queries
  return queries.slice(0, 80);
}

async function searchFirecrawl(query: string, apiKey: string): Promise<any[]> {
  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 20, scrapeOptions: { formats: ["markdown"] } }),
  });
  const data = await res.json();
  if (data.success && data.data) return data.data;
  return [];
}

async function extractJobsBatch(
  results: any[], titles: string[], skills: string[], locationPref: string, experienceLevel: string, apiKey: string
): Promise<any[]> {
  const content = results
    .map((r, i) => `--- Result ${i + 1} ---\nURL: ${r.url || "N/A"}\nTitle: ${r.title || "N/A"}\nContent: ${(r.markdown || r.description || "").substring(0, 600)}`)
    .join("\n\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: 'Extract job listings as JSON array. Each object: {"company":"...","title":"...","url":"...","description":"...","location":"...","salary_info":"..."}. Return ONLY the JSON array, no markdown.' },
        { role: "user", content: `Extract job listings from these search results.\nTarget titles: ${titles.join(", ")}\nSkills: ${skills.join(", ")}\nLocation: ${locationPref}\nExperience: ${experienceLevel}\n\n${content}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "extract_jobs",
          description: "Extract structured job listings",
          parameters: {
            type: "object",
            properties: {
              jobs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    company: { type: "string" }, title: { type: "string" }, url: { type: "string" },
                    description: { type: "string" }, location: { type: "string" }, salary_info: { type: "string" },
                  },
                  required: ["company", "title"], additionalProperties: false,
                },
              },
            },
            required: ["jobs"], additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_jobs" } },
    }),
  });

  if (!res.ok) return [];
  const data = await res.json();
  try {
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) return JSON.parse(toolCall.function.arguments).jobs || [];
  } catch { /* ignore */ }
  return [];
}

async function scoreJobsBatch(
  jobs: any[], profile: any, apiKey: string
): Promise<{ index: number; score: number }[]> {
  const jobDescriptions = jobs.map((j, i) =>
    `Job ${i}: ${j.title} at ${j.company} | Location: ${j.location || "Unknown"} | Salary: ${j.salary_info || "N/A"} | ${(j.description || "").substring(0, 300)}`
  ).join("\n\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Score each job 0-100 for the candidate. Return scores for ALL jobs." },
        {
          role: "user",
          content: `Candidate: Titles: ${(profile.target_titles || []).join(", ")} | Skills: ${(profile.skills || []).join(", ")} | Location: ${profile.location_preference || "remote"} | Min salary: ${profile.min_salary ? "$" + profile.min_salary : "N/A"} | Level: ${profile.experience_level || "mid"}${profile.notes ? " | Notes: " + profile.notes : ""}\n\n${jobDescriptions}`,
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "score_jobs_batch",
          description: "Score multiple jobs for candidate fit",
          parameters: {
            type: "object",
            properties: {
              jobs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" }, score: { type: "number" }, reasoning: { type: "string" },
                  },
                  required: ["index", "score"], additionalProperties: false,
                },
              },
            },
            required: ["jobs"], additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "score_jobs_batch" } },
    }),
  });

  if (!res.ok) return jobs.map((_, i) => ({ index: i, score: 50 }));
  const data = await res.json();
  try {
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) return JSON.parse(toolCall.function.arguments).jobs || [];
  } catch { /* ignore */ }
  return jobs.map((_, i) => ({ index: i, score: 50 }));
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY || !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing API keys" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileError } = await db
      .from("user_profile").select("*").eq("user_id", user.id).single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found. Set up your profile first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const titles: string[] = (profile.target_titles || []).length > 0 ? profile.target_titles : DEFAULT_TITLES;
    const locations: string[] = (profile.target_locations || []).length > 0 ? profile.target_locations : DEFAULT_LOCATIONS;
    const skills: string[] = profile.skills || [];
    const excludedCompanies: string[] = profile.excluded_companies || [];
    const keywordBlacklist: string[] = profile.keyword_blacklist || [];
    const locationPref: string = profile.location_preference || "remote";
    const experienceLevel: string = profile.experience_level || "mid";

    // ── Step 1: Generate queries ──
    const queries = generateQueries(titles, locations);
    console.log(`Generated ${queries.length} search queries`);

    // ── Step 2: Parallel search ──
    const searchResults = await runInBatches(queries, 5, (q) => searchFirecrawl(q, FIRECRAWL_API_KEY));
    const allResults: any[] = [];
    for (const r of searchResults) {
      if (r.status === "fulfilled" && r.value) allResults.push(...r.value);
    }
    console.log(`${allResults.length} raw results from ${queries.length} queries`);

    if (allResults.length === 0) {
      return new Response(JSON.stringify({
        success: true, queries_run: queries.length, raw_results: 0, jobs_extracted: 0,
        jobs_filtered: 0, jobs_scored: 0, jobs_saved: 0, message: "No results found",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Step 3: Batch AI extraction (chunks of 20, parallel batches of 3) ──
    const chunks: any[][] = [];
    for (let i = 0; i < allResults.length; i += 20) {
      chunks.push(allResults.slice(i, i + 20));
    }
    const extractionResults = await runInBatches(chunks, 3, (chunk) =>
      extractJobsBatch(chunk, titles, skills, locationPref, experienceLevel, LOVABLE_API_KEY)
    );
    let allJobs: any[] = [];
    for (const r of extractionResults) {
      if (r.status === "fulfilled" && r.value) allJobs.push(...r.value);
    }
    console.log(`Extracted ${allJobs.length} jobs`);

    // ── Step 4: Filter ──
    const blacklistLower = keywordBlacklist.map((k) => k.toLowerCase());
    const excludedLower = excludedCompanies.map((c) => c.toLowerCase());

    const filteredJobs = allJobs.filter((job) => {
      if (excludedLower.some((c) => (job.company || "").toLowerCase().includes(c))) return false;
      const text = `${job.title} ${job.description}`.toLowerCase();
      if (blacklistLower.some((k) => text.includes(k))) return false;
      return true;
    });
    console.log(`After filtering: ${filteredJobs.length} jobs`);

    // ── Step 5: Batch scoring (groups of 10, parallel batches of 3) ──
    const scoreChunks: any[][] = [];
    for (let i = 0; i < filteredJobs.length; i += 10) {
      scoreChunks.push(filteredJobs.slice(i, i + 10));
    }
    const scoringResults = await runInBatches(scoreChunks, 3, (chunk) =>
      scoreJobsBatch(chunk, profile, LOVABLE_API_KEY)
    );

    // Map scores back
    const scoredJobs: { job: any; score: number }[] = [];
    let chunkOffset = 0;
    for (let ci = 0; ci < scoreChunks.length; ci++) {
      const chunk = scoreChunks[ci];
      const scoreResult = scoringResults[ci];
      const scores: { index: number; score: number }[] =
        scoreResult.status === "fulfilled" ? scoreResult.value : chunk.map((_, i) => ({ index: i, score: 50 }));

      for (let ji = 0; ji < chunk.length; ji++) {
        const scoreEntry = scores.find((s) => s.index === ji);
        const score = scoreEntry ? Math.min(100, Math.max(0, Math.round(scoreEntry.score))) : 50;
        if (score >= 60) {
          scoredJobs.push({ job: chunk[ji], score });
        }
      }
      chunkOffset += chunk.length;
    }
    console.log(`${scoredJobs.length} jobs passed scoring threshold`);

    // ── Step 6: Deduplicate & save ──
    let savedCount = 0;
    for (const { job, score } of scoredJobs) {
      const hashInput = `${(job.company || "").toLowerCase().trim()}|${(job.title || "").toLowerCase().trim()}|${(job.location || "").toLowerCase().trim()}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(hashInput));
      const duplicateHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: existing } = await db.from("job_listings").select("id").eq("user_id", user.id).eq("duplicate_hash", duplicateHash).maybeSingle();
      if (existing) continue;

      const { error: insertError } = await db.from("job_listings").insert({
        user_id: user.id,
        company: job.company || "Unknown",
        title: job.title || "Unknown",
        url: job.url || null,
        description: job.description || null,
        location: job.location || null,
        salary_info: job.salary_info || null,
        score,
        status: "pending",
        source: "firecrawl",
        duplicate_hash: duplicateHash,
      });
      if (!insertError) savedCount++;
      else console.error("Insert error:", insertError);
    }

    console.log(`Scan complete: ${savedCount} jobs saved`);
    return new Response(JSON.stringify({
      success: true,
      queries_run: queries.length,
      raw_results: allResults.length,
      jobs_extracted: allJobs.length,
      jobs_filtered: filteredJobs.length,
      jobs_scored: scoredJobs.length,
      jobs_saved: savedCount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Scan error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
