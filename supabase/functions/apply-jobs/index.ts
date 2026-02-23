import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function appendLog(db: any, jobId: string, step: string, detail: string) {
  const { data } = await db.from("job_listings").select("apply_log").eq("id", jobId).single();
  const log = Array.isArray(data?.apply_log) ? data.apply_log : [];
  log.push({ step, detail, timestamp: new Date().toISOString() });
  await db.from("job_listings").update({ apply_log: log }).eq("id", jobId);
}

async function generateDocs(
  job: any,
  profile: any,
  apiKey: string,
  db: any,
): Promise<{ resume: string; coverLetter: string }> {
  await appendLog(db, job.id, "generating_docs", "Starting document generation");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are a professional career consultant. Generate a tailored resume and cover letter for the candidate applying to a specific job. The resume should highlight relevant skills and experience. The cover letter should be personalized for the company and role. Use professional formatting with clear sections.`,
        },
        {
          role: "user",
          content: `Generate a tailored resume and cover letter for this application.

CANDIDATE PROFILE:
- Resume: ${profile.resume_text || "Not provided"}
- Skills: ${(profile.skills || []).join(", ") || "Not specified"}
- Target Titles: ${(profile.target_titles || []).join(", ") || "Not specified"}
- Experience Level: ${profile.experience_level || "mid"}
- Location Preference: ${profile.location_preference || "remote"}
- Notes: ${profile.notes || "None"}

JOB DETAILS:
- Company: ${job.company}
- Title: ${job.title}
- Location: ${job.location || "Not specified"}
- Description: ${(job.description || "Not provided").substring(0, 1500)}
- Salary: ${job.salary_info || "Not specified"}`,
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "generate_application_docs",
          description: "Generate tailored resume and cover letter",
          parameters: {
            type: "object",
            properties: {
              tailored_resume: {
                type: "string",
                description: "Full tailored resume text, formatted with sections",
              },
              cover_letter: {
                type: "string",
                description: "Full cover letter text, personalized for the company and role",
              },
            },
            required: ["tailored_resume", "cover_letter"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "generate_application_docs" } },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in AI response");

  const parsed = JSON.parse(toolCall.function.arguments);
  return {
    resume: parsed.tailored_resume || "",
    coverLetter: parsed.cover_letter || "",
  };
}

async function processJobs(userId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

  const db = createClient(supabaseUrl, supabaseServiceKey);

  // Get user profile
  const { data: profile } = await db.from("user_profile").select("*").eq("user_id", userId).single();
  if (!profile) {
    console.error("No user profile found");
    return;
  }

  const maxApps = profile.max_applications_per_run || 15;

  // Get approved jobs
  const { data: approvedJobs, error } = await db
    .from("job_listings")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "approved")
    .order("score", { ascending: false })
    .limit(maxApps);

  if (error || !approvedJobs || approvedJobs.length === 0) {
    console.log("No approved jobs to process");
    return;
  }

  console.log(`Processing ${approvedJobs.length} approved jobs`);

  for (const job of approvedJobs) {
    try {
      // Update status to generating_docs
      await db.from("job_listings").update({ status: "generating_docs" }).eq("id", job.id);

      // Generate docs
      const docs = await generateDocs(job, profile, LOVABLE_API_KEY, db);

      // Save docs and update status
      await db.from("job_listings").update({
        tailored_resume_text: docs.resume,
        cover_letter_text: docs.coverLetter,
        status: "ready_to_apply",
      }).eq("id", job.id);

      await appendLog(db, job.id, "ready", "Documents generated successfully");
      console.log(`Generated docs for job ${job.id}: ${job.title} at ${job.company}`);
    } catch (err) {
      console.error(`Failed to process job ${job.id}:`, err);
      await db.from("job_listings").update({ status: "failed" }).eq("id", job.id);
      await appendLog(db, job.id, "failed", err instanceof Error ? err.message : "Unknown error");
    }
  }

  console.log("All jobs processed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!Deno.env.get("LOVABLE_API_KEY")) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Start background processing
    EdgeRuntime.waitUntil(
      processJobs(user.id).catch((err) => {
        console.error("Background apply failed:", err);
      })
    );

    return new Response(JSON.stringify({
      success: true,
      message: "Document generation started. Jobs will update to 'ready_to_apply' shortly.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Apply error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
