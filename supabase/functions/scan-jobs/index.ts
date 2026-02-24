import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_TITLES = [
  "AI Product Manager", "Technical Product Manager", "AI Platform Manager",
  "Full Stack Developer AI", "LLM Engineer", "AI Developer",
];

const DEFAULT_LOCATIONS = ["Riyadh Saudi Arabia", "Dubai UAE", "Calgary Canada", "Remote"];

// ── Helpers ──
function generateQueries(titles: string[], locations: string[]): string[] {
  const queries: string[] = [];
  const topTitles = titles.slice(0, 3);
  const topLocations = locations.slice(0, 4);
  for (const title of topTitles) {
    for (const loc of topLocations) {
      queries.push(`${title} ${loc} job`);
    }
  }
  return queries.slice(0, 12);
}

async function searchFirecrawl(query: string, apiKey: string): Promise<any[]> {
  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 10, scrapeOptions: { formats: ["markdown"] } }),
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

async function enrichCompany(companyName: string, firecrawlKey: string, lovableKey: string): Promise<string> {
  console.log(`[enrich] Searching for company info: ${companyName}`);
  try {
    const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `${companyName} company about`, limit: 3, scrapeOptions: { formats: ["markdown"] } }),
    });
    const searchData = await searchRes.json();
    const pages = searchData.success && searchData.data ? searchData.data : [];
    if (pages.length === 0) return "";

    const content = pages.map((p: any) => (p.markdown || p.description || "").substring(0, 800)).join("\n\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Summarize what this company does in 2-3 sentences. Focus on their industry, products/services, and what makes them notable. Be factual and concise." },
          { role: "user", content: `Company: ${companyName}\n\nInfo:\n${content}` },
        ],
      }),
    });
    if (!aiRes.ok) return "";
    const aiData = await aiRes.json();
    return aiData.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error(`[enrich] Error for ${companyName}:`, e);
    return "";
  }
}

// ── Main scan ──
async function runScan(userId: string): Promise<{
  queries_run: number; raw_results: number; jobs_extracted: number;
  jobs_filtered: number; jobs_scored: number; jobs_saved: number;
}> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

  const db = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await db.from("user_profile").select("*").eq("user_id", userId).single();
  if (!profile) throw new Error("No profile found");

  const titles: string[] = (profile.target_titles || []).length > 0 ? profile.target_titles : DEFAULT_TITLES;
  const locations: string[] = (profile.target_locations || []).length > 0 ? profile.target_locations : DEFAULT_LOCATIONS;
  const skills: string[] = profile.skills || [];
  const excludedCompanies: string[] = profile.excluded_companies || [];
  const keywordBlacklist: string[] = profile.keyword_blacklist || [];
  const locationPref: string = profile.location_preference || "remote";
  const experienceLevel: string = profile.experience_level || "mid";

  // Step 1: Generate queries (max 12)
  const queries = generateQueries(titles, locations);
  console.log(`[scan] Step 1: Generated ${queries.length} queries`);

  // Step 2: Search (batches of 3)
  console.log(`[scan] Step 2: Searching via Firecrawl...`);
  const allResults: any[] = [];
  for (let i = 0; i < queries.length; i += 3) {
    const batch = queries.slice(i, i + 3);
    const batchResults = await Promise.allSettled(batch.map((q) => searchFirecrawl(q, FIRECRAWL_API_KEY)));
    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) allResults.push(...r.value);
    }
  }
  console.log(`[scan] Step 2 done: ${allResults.length} raw results`);

  if (allResults.length === 0) {
    return { queries_run: queries.length, raw_results: 0, jobs_extracted: 0, jobs_filtered: 0, jobs_scored: 0, jobs_saved: 0 };
  }

  // Step 3: AI extraction (chunks of 15)
  console.log(`[scan] Step 3: Extracting jobs via AI...`);
  const chunks: any[][] = [];
  for (let i = 0; i < allResults.length; i += 15) {
    chunks.push(allResults.slice(i, i + 15));
  }
  let allJobs: any[] = [];
  for (const chunk of chunks) {
    const jobs = await extractJobsBatch(chunk, titles, skills, locationPref, experienceLevel, LOVABLE_API_KEY);
    allJobs.push(...jobs);
  }
  console.log(`[scan] Step 3 done: ${allJobs.length} jobs extracted`);

  // Step 4: Filter
  const blacklistLower = keywordBlacklist.map((k) => k.toLowerCase());
  const excludedLower = excludedCompanies.map((c) => c.toLowerCase());
  const filteredJobs = allJobs.filter((job) => {
    if (excludedLower.some((c) => (job.company || "").toLowerCase().includes(c))) return false;
    const text = `${job.title} ${job.description}`.toLowerCase();
    if (blacklistLower.some((k) => text.includes(k))) return false;
    return true;
  });
  console.log(`[scan] Step 4: ${filteredJobs.length} jobs after filtering`);

  // Step 5: Score
  console.log(`[scan] Step 5: Scoring jobs...`);
  const scores = await scoreJobsBatch(filteredJobs, profile, LOVABLE_API_KEY);
  const scoredJobs = filteredJobs.map((job, i) => {
    const scoreEntry = scores.find((s) => s.index === i);
    return { job, score: scoreEntry ? Math.min(100, Math.max(0, Math.round(scoreEntry.score))) : 50 };
  });
  scoredJobs.sort((a, b) => b.score - a.score);
  console.log(`[scan] Step 5 done: ${scoredJobs.length} scored, top score: ${scoredJobs[0]?.score}`);

  // Keep top 5
  const topJobs = scoredJobs.slice(0, 5);
  console.log(`[scan] Keeping top ${topJobs.length} jobs`);

  // Step 6: Enrich companies
  console.log(`[scan] Step 6: Enriching company info...`);
  const enrichedDescriptions: Map<string, string> = new Map();
  for (const { job } of topJobs) {
    const company = job.company || "Unknown";
    if (!enrichedDescriptions.has(company)) {
      const desc = await enrichCompany(company, FIRECRAWL_API_KEY, LOVABLE_API_KEY);
      enrichedDescriptions.set(company, desc);
      console.log(`[scan] Enriched "${company}": ${desc.substring(0, 80)}...`);
    }
  }

  // Step 7: Deduplicate & save
  console.log(`[scan] Step 7: Saving to database...`);
  let savedCount = 0;
  for (const { job, score } of topJobs) {
    const hashInput = `${(job.company || "").toLowerCase().trim()}|${(job.title || "").toLowerCase().trim()}|${(job.location || "").toLowerCase().trim()}`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(hashInput));
    const duplicateHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const { data: existing } = await db.from("job_listings").select("id").eq("user_id", userId).eq("duplicate_hash", duplicateHash).maybeSingle();
    if (existing) {
      console.log(`[scan] Skipping duplicate: ${job.title} at ${job.company}`);
      continue;
    }

    const companyDesc = enrichedDescriptions.get(job.company || "Unknown") || null;

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
      company_description: companyDesc,
    });
    if (!insertError) {
      savedCount++;
      console.log(`[scan] Saved: ${job.title} at ${job.company} (score: ${score})`);
    } else {
      console.error(`[scan] Insert error:`, insertError);
    }
  }

  console.log(`[scan] Done! Saved ${savedCount} new jobs`);
  return {
    queries_run: queries.length,
    raw_results: allResults.length,
    jobs_extracted: allJobs.length,
    jobs_filtered: filteredJobs.length,
    jobs_scored: scoredJobs.length,
    jobs_saved: savedCount,
  };
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

    console.log(`[scan] Starting scan for user ${user.id}`);
    const result = await runScan(user.id);

    return new Response(JSON.stringify({
      success: true,
      ...result,
      message: `Found ${result.jobs_saved} new jobs (${result.queries_run} queries, ${result.raw_results} results, ${result.jobs_extracted} extracted, ${result.jobs_scored} scored).`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[scan] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
