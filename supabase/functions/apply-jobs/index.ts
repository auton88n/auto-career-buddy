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
): Promise<{ resume: string; coverLetter: string }> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are a professional career consultant. Generate a tailored resume and cover letter.

RESUME FORMAT (follow this exact structure using markdown):
# [Full Name]
> [Professional Title | Subtitle]
[contact info line with • separators: email • website • phone • location • languages]

## PROFESSIONAL PROFILE
[2-3 sentence summary tailored to the target job]

## WORK EXPERIENCE
### [Job Title] | [Company] | [Dates]
- [Achievement with quantified result]
- [Achievement with quantified result]
(repeat for each role, most relevant first)

## EDUCATION & CERTIFICATIONS
### [Degree] | [University] | [Dates]
[Any certifications on separate lines]

## SKILLS
- [Category]: [comma-separated skills]
- [Category]: [comma-separated skills]

COVER LETTER FORMAT:
Write a professional, personalized cover letter. Start with "Dear Hiring Team," or similar. 3-4 paragraphs: intro with enthusiasm for the role, 1-2 paragraphs highlighting relevant experience, closing with call to action. End with "Sincerely," and the candidate's name.

IMPORTANT: Tailor BOTH documents specifically to the job description and company. Emphasize the most relevant experience.`,
        },
        {
          role: "user",
          content: `Generate a tailored resume and cover letter.

CANDIDATE PROFILE:
${profile.resume_text ? `Resume:\n${profile.resume_text}` : "No resume provided - create a general professional resume based on the skills and titles below."}
Skills: ${(profile.skills || []).join(", ") || "Not specified"}
Target Titles: ${(profile.target_titles || []).join(", ") || "Not specified"}
Experience Level: ${profile.experience_level || "mid"}
Location: ${profile.location_preference || "remote"}
${profile.notes ? `Additional Notes: ${profile.notes}` : ""}

JOB:
Company: ${job.company}
Title: ${job.title}
Location: ${job.location || "Not specified"}
Description: ${(job.description || "Not provided").substring(0, 2000)}
Salary: ${job.salary_info || "Not specified"}`,
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
                description: "Complete tailored resume text with professional formatting",
              },
              cover_letter: {
                type: "string",
                description: "Complete cover letter text personalized for the company and role",
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

interface ProcessedJob {
  id: string;
  company: string;
  title: string;
  status: string;
  error?: string;
}

async function processJobs(userId: string, specificJobIds?: string[]): Promise<ProcessedJob[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

  console.log("[apply-jobs] Starting processJobs for user:", userId, "specificJobIds:", specificJobIds);

  const db = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await db.from("user_profile").select("*").eq("user_id", userId).single();
  console.log("[apply-jobs] Profile fetch:", profile ? "found" : "not found", profileError?.message || "");
  if (!profile) throw new Error("No user profile found");

  const maxApps = profile.max_applications_per_run || 15;

  let query = db
    .from("job_listings")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "approved")
    .order("score", { ascending: false })
    .limit(maxApps);

  if (specificJobIds && specificJobIds.length > 0) {
    query = db
      .from("job_listings")
      .select("*")
      .eq("user_id", userId)
      .in("id", specificJobIds)
      .in("status", ["approved"])
      .order("score", { ascending: false });
  }

  const { data: approvedJobs, error } = await query;

  console.log("[apply-jobs] Found", approvedJobs?.length || 0, "approved jobs. Error:", error?.message || "none");

  if (error) throw error;
  if (!approvedJobs || approvedJobs.length === 0) return [];

  const results: ProcessedJob[] = [];

  for (const job of approvedJobs) {
    try {
      console.log("[apply-jobs] Processing job:", job.id, job.title, "at", job.company);
      const { error: statusErr } = await db.from("job_listings").update({ status: "generating_docs" }).eq("id", job.id);
      if (statusErr) console.error("[apply-jobs] Status update error:", statusErr.message);
      await appendLog(db, job.id, "generating_docs", "Starting document generation");

      const docs = await generateDocs(job, profile, LOVABLE_API_KEY);
      console.log("[apply-jobs] AI generated docs. Resume length:", docs.resume.length, "Cover letter length:", docs.coverLetter.length);

      const { error: saveErr } = await db.from("job_listings").update({
        tailored_resume_text: docs.resume,
        cover_letter_text: docs.coverLetter,
        status: "ready_to_apply",
      }).eq("id", job.id);

      if (saveErr) {
        console.error("[apply-jobs] SAVE ERROR:", saveErr.message, saveErr.details, saveErr.hint);
        throw new Error(`Failed to save documents: ${saveErr.message}`);
      }

      console.log("[apply-jobs] Documents saved successfully for job:", job.id);
      await appendLog(db, job.id, "ready", "Documents generated successfully");
      results.push({ id: job.id, company: job.company, title: job.title, status: "ready_to_apply" });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await db.from("job_listings").update({ status: "failed" }).eq("id", job.id);
      await appendLog(db, job.id, "failed", errorMsg);
      results.push({ id: job.id, company: job.company, title: job.title, status: "failed", error: errorMsg });
    }
  }

  return results;
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
    const body = await req.json().catch(() => ({}));
    const jobIds = body.job_ids || undefined;

    // Process synchronously - user sees results immediately
    const results = await processJobs(user.id, jobIds);

    const successful = results.filter((r) => r.status === "ready_to_apply").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return new Response(JSON.stringify({
      success: true,
      jobs_processed: results.length,
      successful,
      failed,
      results,
      message: `Generated documents for ${successful} job(s)${failed > 0 ? `, ${failed} failed` : ""}.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Apply error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
