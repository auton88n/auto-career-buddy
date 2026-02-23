import { supabase } from "@/integrations/supabase/client";

export interface ScanResult {
  success: boolean;
  queries_run?: number;
  raw_results?: number;
  jobs_found?: number;
  jobs_extracted?: number;
  jobs_filtered?: number;
  jobs_scored?: number;
  jobs_saved?: number;
  message?: string;
  error?: string;
}

export interface JobListing {
  id: string;
  company: string;
  title: string;
  url: string | null;
  description: string | null;
  location: string | null;
  salary_info: string | null;
  score: number;
  status: string;
  source: string | null;
  created_at: string;
  updated_at: string;
  tailored_resume_text: string | null;
  cover_letter_text: string | null;
  apply_log: any[] | null;
}

export const jobsApi = {
  async scanJobs(): Promise<ScanResult> {
    const { data, error } = await supabase.functions.invoke("scan-jobs", {
      body: {},
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  async getJobs(status?: string): Promise<JobListing[]> {
    let query = supabase
      .from("job_listings")
      .select("*")
      .order("score", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as JobListing[]) || [];
  },

  async getJobCounts(): Promise<{
    total: number;
    pending: number;
    applied: number;
    approved: number;
    manual_required: number;
    generating_docs: number;
    ready_to_apply: number;
    failed: number;
  }> {
    const { data, error } = await supabase.from("job_listings").select("status");
    if (error) throw error;
    const counts = {
      total: 0, pending: 0, applied: 0, approved: 0,
      manual_required: 0, generating_docs: 0, ready_to_apply: 0, failed: 0,
    };
    (data || []).forEach((row: any) => {
      counts.total++;
      const s = row.status as keyof typeof counts;
      if (s in counts && s !== "total") counts[s]++;
    });
    return counts;
  },

  async updateJobStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from("job_listings")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  },

  async applyToJobs(jobIds?: string[]): Promise<{ success: boolean; message?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke("apply-jobs", {
      body: { job_ids: jobIds },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  async getApplicationDocs(jobId: string): Promise<{ resume: string | null; coverLetter: string | null; log: any[] }> {
    const { data, error } = await supabase
      .from("job_listings")
      .select("tailored_resume_text, cover_letter_text, apply_log")
      .eq("id", jobId)
      .single();
    if (error) throw error;
    return {
      resume: (data as any)?.tailored_resume_text || null,
      coverLetter: (data as any)?.cover_letter_text || null,
      log: (data as any)?.apply_log || [],
    };
  },
};
