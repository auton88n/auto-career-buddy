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

  async getJobCounts(): Promise<{ total: number; pending: number; applied: number; manual_required: number }> {
    const { data, error } = await supabase.from("job_listings").select("status");
    if (error) throw error;
    const counts = { total: 0, pending: 0, applied: 0, manual_required: 0 };
    (data || []).forEach((row: any) => {
      counts.total++;
      if (row.status === "pending") counts.pending++;
      else if (row.status === "applied") counts.applied++;
      else if (row.status === "manual_required") counts.manual_required++;
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
};
