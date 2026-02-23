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

  // Title x Location combinations (cap titles to 5, locations to 4)
  const topTitles = titles.slice(0, 5);
  const topLocations = locations.slice(0, 4);
  for (const title of topTitles) {
    for (const loc of topLocations) {
      queries.push(`${title} ${loc} job`);
    }
  }

  // Title x Job board site filters (top 3 titles x top 4 sites)
  for (const title of topTitles.slice(0, 3)) {
    for (const site of JOB_BOARD_SITES.slice(0, 4)) {
      queries.push(`${title} ${site}`);
    }
  }

  // Company career page queries (sample 10 companies)
  const sampledCompanies = ALL_COMPANIES.sort(() => Math.random() - 0.5).slice(0, 10);
  const mainTitle = titles[0] || "Product Manager";
  for (const company of sampledCompanies) {
    queries.push(`"${company}" careers ${mainTitle}`);
  }

  // Cap at 42 queries to stay well within resource limits
  return queries.slice(0, 42);
}

async function searchFirecrawl(query: string, apiKey: string): Promise<any[]> {
  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 15, scrapeOptions: { formats: ["markdown"] } }),
  });
  const data = await res.json();
  if (data.success && data.data) return data.data;
  return [];
}

async function extractJobsBatch(
  results: any[], titles: string[], skills: string[], locationPref: string, experienceLevel: string, apiKey: string
): Promise<any[]> {
  const content = results
    .map((r, i) => `--- Result ${i + 1} ---\nURL: ${r.url || "N/A"}\nTitle: ${r.title || "N/A"}\nContent: ${(r.markdown || r.description || "").substring(0, 500)}`)
    .join("\n\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: 'Extract job listings as JSON array. Each object: {"company":"...","title":"...","url":"...","description":"...","location":"...","salary_info":"..."}. Return ONLY the JSON array, no markdown.' },
        { role: "user", content: `Extract job listings.\nTarget titles: ${titles.join(", ")}\nSkills: ${skills.join(", ")}\nLocation: ${locationPref}\nExperience: ${experienceLevel}\n\n${content}` },
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
    `Job ${i}: ${j.title} at ${j.company} | Location: ${j.location || "Unknown"} | Salary: ${j.salary_info || "N/A"} | ${(j.description || "").substring(0, 200)}`
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

// ── Background scan processor ──
async function runScan(userId: string, authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

  const db = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await db.from("user_profile").select("*").eq("user_id", userId).single();
  if (!profile) { console.error("No profile"); return; }

  const titles: string[] = (profile.target_titles || []).length > 0 ? profile.target_titles : DEFAULT_TITLES;
  const locations: string[] = (profile.target_locations || []).length > 0 ? profile.target_locations : DEFAULT_LOCATIONS;
  const skills: string[] = profile.skills || [];
  const excludedCompanies: string[] = profile.excluded_companies || [];
  const keywordBlacklist: string[] = profile.keyword_blacklist || [];
  const locationPref: string = profile.location_preference || "remote";
  const experienceLevel: string = profile.experience_level || "mid";

  // Step 1: Generate queries
  const queries = generateQueries(titles, locations);
  console.log(`Generated ${queries.length} search queries`);

  // Step 2: Parallel search (batches of 3 to limit concurrency)
  const searchResults = await runInBatches(queries, 3, (q) => searchFirecrawl(q, FIRECRAWL_API_KEY));
  const allResults: any[] = [];
  for (const r of searchResults) {
    if (r.status === "fulfilled" && r.value) allResults.push(...r.value);
  }
  console.log(`${allResults.length} raw results from ${queries.length} queries`);
  if (allResults.length === 0) { console.log("No results found"); return; }

  // Step 3: Batch AI extraction (chunks of 15, sequential to limit CPU)
  const chunks: any[][] = [];
  for (let i = 0; i < allResults.length; i += 15) {
    chunks.push(allResults.slice(i, i + 15));
  }
  const extractionResults = await runInBatches(chunks, 2, (chunk) =>
    extractJobsBatch(chunk, titles, skills, locationPref, experienceLevel, LOVABLE_API_KEY)
  );
  let allJobs: any[] = [];
  for (const r of extractionResults) {
    if (r.status === "fulfilled" && r.value) allJobs.push(...r.value);
  }
  console.log(`Extracted ${allJobs.length} jobs`);

  // Step 4: Filter
  const blacklistLower = keywordBlacklist.map((k) => k.toLowerCase());
  const excludedLower = excludedCompanies.map((c) => c.toLowerCase());
  const filteredJobs = allJobs.filter((job) => {
    if (excludedLower.some((c) => (job.company || "").toLowerCase().includes(c))) return false;
    const text = `${job.title} ${job.description}`.toLowerCase();
    if (blacklistLower.some((k) => text.includes(k))) return false;
    return true;
  });
  console.log(`After filtering: ${filteredJobs.length} jobs`);

  // Step 5: Batch scoring (groups of 8, batches of 2)
  const scoreChunks: any[][] = [];
  for (let i = 0; i < filteredJobs.length; i += 8) {
    scoreChunks.push(filteredJobs.slice(i, i + 8));
  }
  const scoringResults = await runInBatches(scoreChunks, 2, (chunk) =>
    scoreJobsBatch(chunk, profile, LOVABLE_API_KEY)
  );

  const scoredJobs: { job: any; score: number }[] = [];
  for (let ci = 0; ci < scoreChunks.length; ci++) {
    const chunk = scoreChunks[ci];
    const scoreResult = scoringResults[ci];
    const scores: { index: number; score: number }[] =
      scoreResult.status === "fulfilled" ? scoreResult.value : chunk.map((_, i) => ({ index: i, score: 50 }));
    for (let ji = 0; ji < chunk.length; ji++) {
      const scoreEntry = scores.find((s) => s.index === ji);
      const score = scoreEntry ? Math.min(100, Math.max(0, Math.round(scoreEntry.score))) : 50;
      if (score >= 60) scoredJobs.push({ job: chunk[ji], score });
    }
  }
  console.log(`${scoredJobs.length} jobs passed scoring threshold`);

  // Step 6: Deduplicate & save
  let savedCount = 0;
  for (const { job, score } of scoredJobs) {
    const hashInput = `${(job.company || "").toLowerCase().trim()}|${(job.title || "").toLowerCase().trim()}|${(job.location || "").toLowerCase().trim()}`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(hashInput));
    const duplicateHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const { data: existing } = await db.from("job_listings").select("id").eq("user_id", userId).eq("duplicate_hash", duplicateHash).maybeSingle();
    if (existing) continue;

    const { error: insertError } = await db.from("job_listings").insert({
      user_id: userId,
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

  console.log(`Scan complete: ${savedCount} new jobs saved out of ${scoredJobs.length} scored`);
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!Deno.env.get("FIRECRAWL_API_KEY") || !Deno.env.get("LOVABLE_API_KEY")) {
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

    // Start background scan and return immediately
    EdgeRuntime.waitUntil(
      runScan(user.id, authHeader).catch((err) => {
        console.error("Background scan failed:", err);
      })
    );

    return new Response(JSON.stringify({
      success: true,
      message: "Scan started in background. New jobs will appear shortly — refresh in ~60 seconds.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Scan error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
