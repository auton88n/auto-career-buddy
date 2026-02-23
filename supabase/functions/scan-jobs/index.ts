import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Get user from token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for DB operations
    const db = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user profile
    const { data: profile, error: profileError } = await db
      .from("user_profile")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found. Please set up your profile first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetTitles: string[] = profile.target_titles || [];
    const skills: string[] = profile.skills || [];
    const industries: string[] = profile.industries || [];
    const locationPref: string = profile.location_preference || "remote";
    const excludedCompanies: string[] = profile.excluded_companies || [];
    const keywordBlacklist: string[] = profile.keyword_blacklist || [];
    const minSalary: number | null = profile.min_salary;
    const experienceLevel: string = profile.experience_level || "mid";

    if (targetTitles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No target job titles configured. Please update your profile." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build search queries from profile
    const searchQueries = targetTitles.map((title) => {
      let q = `${title} job posting`;
      if (locationPref === "remote") q += " remote";
      if (industries.length > 0) q += ` ${industries[0]}`;
      return q;
    });

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting job scan for user ${user.id} with ${searchQueries.length} queries`);

    // Step 1: Search with Firecrawl
    const allResults: any[] = [];
    for (const query of searchQueries.slice(0, 3)) {
      console.log("Searching:", query);
      try {
        const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            limit: 10,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });

        const searchData = await searchRes.json();
        if (searchData.success && searchData.data) {
          allResults.push(...searchData.data);
        } else {
          console.error("Firecrawl search failed:", searchData);
        }
      } catch (e) {
        console.error("Firecrawl search error:", e);
      }
    }

    console.log(`Found ${allResults.length} raw results`);

    if (allResults.length === 0) {
      return new Response(
        JSON.stringify({ success: true, jobs_found: 0, jobs_saved: 0, message: "No results found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Extract job data with AI
    const extractionPrompt = `You are a job listing parser. Given the following search results, extract individual job listings.
For each job, extract: company, title, url, description (brief), location, salary_info.
Only include actual job postings (not blog posts, news articles, etc).
Return ONLY valid JSON array.

User preferences for context:
- Target titles: ${targetTitles.join(", ")}
- Skills: ${skills.join(", ")}
- Location: ${locationPref}
- Experience: ${experienceLevel}

Search results:
${allResults
  .slice(0, 15)
  .map(
    (r, i) =>
      `--- Result ${i + 1} ---\nURL: ${r.url || "N/A"}\nTitle: ${r.title || "N/A"}\nContent: ${(r.markdown || r.description || "").substring(0, 800)}`
  )
  .join("\n\n")}`;

    const extractRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                'Extract job listings as JSON array. Each object: {"company":"...","title":"...","url":"...","description":"...","location":"...","salary_info":"..."}. Return ONLY the JSON array, no markdown.',
            },
            { role: "user", content: extractionPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_jobs",
                description: "Extract structured job listings from search results",
                parameters: {
                  type: "object",
                  properties: {
                    jobs: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          company: { type: "string" },
                          title: { type: "string" },
                          url: { type: "string" },
                          description: { type: "string" },
                          location: { type: "string" },
                          salary_info: { type: "string" },
                        },
                        required: ["company", "title"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["jobs"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_jobs" } },
        }),
      }
    );

    if (!extractRes.ok) {
      const errText = await extractRes.text();
      console.error("AI extraction error:", extractRes.status, errText);
      if (extractRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (extractRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to extract jobs from search results" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extractData = await extractRes.json();
    let jobs: any[] = [];
    try {
      const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const parsed = JSON.parse(toolCall.function.arguments);
        jobs = parsed.jobs || [];
      }
    } catch (e) {
      console.error("Failed to parse extracted jobs:", e);
    }

    console.log(`Extracted ${jobs.length} job listings`);

    // Step 3: Filter pipeline
    const blacklistLower = keywordBlacklist.map((k) => k.toLowerCase());
    const excludedLower = excludedCompanies.map((c) => c.toLowerCase());

    const filteredJobs = jobs.filter((job) => {
      // Company exclusion
      if (excludedLower.some((c) => (job.company || "").toLowerCase().includes(c))) {
        console.log(`Excluded company: ${job.company}`);
        return false;
      }
      // Keyword blacklist
      const text = `${job.title} ${job.description}`.toLowerCase();
      if (blacklistLower.some((k) => text.includes(k))) {
        console.log(`Blacklisted: ${job.title}`);
        return false;
      }
      return true;
    });

    console.log(`After filtering: ${filteredJobs.length} jobs`);

    // Step 4: Duplicate detection + scoring + save
    let savedCount = 0;
    for (const job of filteredJobs) {
      // Generate duplicate hash
      const hashInput = `${(job.company || "").toLowerCase().trim()}|${(job.title || "").toLowerCase().trim()}|${(job.location || "").toLowerCase().trim()}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(hashInput));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const duplicateHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Check for existing
      const { data: existing } = await db
        .from("job_listings")
        .select("id")
        .eq("user_id", user.id)
        .eq("duplicate_hash", duplicateHash)
        .maybeSingle();

      if (existing) {
        console.log(`Duplicate skipped: ${job.title} at ${job.company}`);
        continue;
      }

      // AI Scoring
      const scorePrompt = `Score this job listing for the candidate. Return a score from 0-100.

Candidate Profile:
- Target titles: ${targetTitles.join(", ")}
- Skills: ${skills.join(", ")}
- Location preference: ${locationPref}
- Minimum salary: ${minSalary ? `$${minSalary}` : "Not specified"}
- Experience level: ${experienceLevel}

Job:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location || "Unknown"}
- Salary: ${job.salary_info || "Not specified"}
- Description: ${(job.description || "").substring(0, 500)}

Scoring criteria:
- Role match (30pts): How well does the title match target titles?
- Remote preference (20pts): Does location match preference?
- Salary match (15pts): Does salary meet minimum?
- Skills match (20pts): Does description mention candidate skills?
- Company fit (15pts): Industry/company relevance`;

      let score = 50; // default
      try {
        const scoreRes = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content: "You are a job scoring assistant. Return ONLY a number 0-100.",
                },
                { role: "user", content: scorePrompt },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "score_job",
                    description: "Return a job match score",
                    parameters: {
                      type: "object",
                      properties: {
                        score: { type: "number", description: "Score 0-100" },
                        reasoning: { type: "string", description: "Brief reasoning" },
                      },
                      required: ["score"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "score_job" } },
            }),
          }
        );

        if (scoreRes.ok) {
          const scoreData = await scoreRes.json();
          const toolCall = scoreData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const parsed = JSON.parse(toolCall.function.arguments);
            score = Math.min(100, Math.max(0, Math.round(parsed.score)));
          }
        }
      } catch (e) {
        console.error("Scoring error:", e);
      }

      // Only save jobs scoring 60+
      if (score < 60) {
        console.log(`Low score (${score}): ${job.title} at ${job.company}`);
        continue;
      }

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

      if (insertError) {
        console.error("Insert error:", insertError);
      } else {
        savedCount++;
        console.log(`Saved job (score ${score}): ${job.title} at ${job.company}`);
      }
    }

    console.log(`Scan complete: ${savedCount} jobs saved`);

    return new Response(
      JSON.stringify({
        success: true,
        jobs_found: allResults.length,
        jobs_extracted: jobs.length,
        jobs_filtered: filteredJobs.length,
        jobs_saved: savedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scan error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
