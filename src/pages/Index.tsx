import { useEffect, useState } from "react";
import removeMd from "remove-markdown";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Briefcase, CheckCircle, Clock, AlertTriangle, ExternalLink,
  Loader2, Search, Download, FileText, ChevronDown, ChevronUp, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type JobListing = Tables<"job_listings">;

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  skipped: { label: "Skipped", variant: "secondary" },
  applied: { label: "Applied", variant: "default" },
  manual_required: { label: "Manual", variant: "destructive" },
  generating_docs: { label: "Generating...", variant: "outline" },
  ready_to_apply: { label: "Ready", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

function stripMarkdown(t: string): string {
  return t
    .replace(/^#{1,6} */gm, "")
    .replace(/^> */gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/—/g, "")
    .replace(/–/g, "-")
    .replace(/`(.+?)`/g, "$1");
}

function buildResumeHTML(rawText: string): string {
  const text = stripMarkdown(rawText);
  const lines = text.split("\n");
  let html = "";
  let lineNum = 0;
  for (const raw of lines) {
    const line = raw.trim();

    if (line === "" || line === "---") { if (lineNum > 0) html += `<div class="gap"></div>`; continue; }
    if (lineNum === 0) { html += `<div class="name">${line}</div>`; lineNum++; continue; }
    if (lineNum === 1 && !line.includes("@") && !line.includes("+966") && !line.includes("+1 (")) { html += `<div class="subtitle">${line}</div>`; lineNum++; continue; }
    if (line.includes("@") || line.includes("+966") || line.includes("+1 (") || (lineNum <= 3 && line.includes("•") && line.includes("."))) { html += `<div class="contact">${line}</div>`; lineNum++; continue; }
    const isHeader = (line === line.toUpperCase() && line.replace(/[^A-Z]/g, "").length > 2 && !line.startsWith("•") && line.length < 60);
    if (isHeader) { html += `<div class="section-header">${line}</div>`; lineNum++; continue; }
    if (line.includes(" | ") && !line.startsWith("•")) { html += `<div class="job-title">${line}</div>`; lineNum++; continue; }
    if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) { html += `<div class="bullet">• ${line.replace(/^[•\-\*]\s*/, "")}</div>`; lineNum++; continue; }
    html += `<div class="normal">${line}</div>`;
    lineNum++;
  }
  return html;
}

async function downloadAsPDF(text: string, filename: string) {
  const { jsPDF } = await import("jspdf");

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;width:700px;background:white;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;box-sizing:border-box;";
  container.innerHTML = `<style>
    *{margin:0;padding:0;box-sizing:border-box;}
    .name{font-size:22pt;font-weight:bold;margin-bottom:4px;line-height:1.2;text-align:center;}
    .subtitle{font-size:12pt;color:#444;margin-bottom:3px;text-align:center;}
    .contact{font-size:9pt;color:#666;margin-bottom:14px;text-align:center;}
    .gap{height:4px;}
    .section-header{font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;margin-top:12px;margin-bottom:4px;padding-bottom:2px;border-bottom:1.5px solid #111;}
    .job-title{font-size:10pt;font-weight:bold;margin-top:6px;margin-bottom:2px;}
    .bullet{font-size:9.5pt;padding-left:12px;text-indent:-6px;margin-bottom:2px;line-height:1.4;}
    .normal{font-size:9.5pt;margin-bottom:2px;line-height:1.4;}
  </style>${buildResumeHTML(text)}`;
  document.body.appendChild(container);

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  await new Promise<void>((resolve) => {
    pdf.html(container, {
      callback: (doc) => {
        doc.save(`${filename}.pdf`);
        resolve();
      },
      x: 40,
      y: 40,
      width: 515,
      windowWidth: 700,
    });
  });
  document.body.removeChild(container);
}


export default function Index() {
  const { user, session } = useAuth();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<JobListing | null>(null);

  const stats = {
    total: jobs.length,
    pending: jobs.filter((j) => j.status === "pending").length,
    applied: jobs.filter((j) => j.status === "applied").length,
    manual: jobs.filter((j) => j.status === "manual_required").length,
    ready: jobs.filter((j) => j.status === "ready_to_apply").length,
  };

  const loadJobs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("job_listings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setJobs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadJobs();
    const channel = supabase
      .channel("job_listings_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "job_listings", filter: `user_id=eq.${user.id}` }, () => loadJobs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const updateJobStatus = async (id: string, status: string) => {
    await supabase.from("job_listings").update({ status }).eq("id", id);
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
  };

  const runScan = async () => {
    if (!session) return;
    setScanning(true);
    toast.info("Scanning for jobs...", { description: "This may take 1-2 minutes" });
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-jobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Scan complete! ${data.jobs_saved} new jobs found`, {
          description: `${data.queries_run} queries → ${data.raw_results} results → ${data.jobs_extracted} extracted → ${data.jobs_scored} scored`,
        });
        await loadJobs();
      } else {
        toast.error("Scan failed", { description: data.error });
      }
    } catch (e) {
      toast.error("Scan error", { description: String(e) });
    } finally {
      setScanning(false);
    }
  };

  const generateDocs = async (job: JobListing) => {
    if (!session) return;
    setGeneratingDocs(job.id);
    toast.info(`Generating documents for ${job.title} at ${job.company}...`);
    try {
      await supabase.from("job_listings").update({ status: "approved", tailored_resume_text: null, cover_letter_text: null }).eq("id", job.id);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apply-jobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ job_ids: [job.id] }),
      });
      const data = await res.json();
      if (data.success && data.successful > 0) {
        toast.success("Documents generated!", { description: "Resume and cover letter are ready to download" });
        await loadJobs();
      } else {
        toast.error("Generation failed", { description: data.results?.[0]?.error || data.error });
      }
    } catch (e) {
      toast.error("Error", { description: String(e) });
    } finally {
      setGeneratingDocs(null);
    }
  };

  const statCards = [
    { label: "Total Found", value: stats.total, icon: Briefcase, color: "text-primary" },
    { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-yellow-500" },
    { label: "Ready to Apply", value: stats.ready, icon: FileText, color: "text-blue-500" },
    { label: "Applied", value: stats.applied, icon: CheckCircle, color: "text-green-500" },
    { label: "Manual Required", value: stats.manual, icon: AlertTriangle, color: "text-red-500" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Your job application pipeline at a glance.</p>
        </div>
        <Button className="gap-2" onClick={runScan} disabled={scanning}>
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {scanning ? "Scanning..." : "Scan for Jobs"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Job Listings</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Briefcase className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">No jobs found yet</p>
              <p className="text-sm text-muted-foreground/70">Set up your profile and run a scan to discover jobs.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <>
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.company}</TableCell>
                      <TableCell>{job.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{job.location || "—"}</TableCell>
                      <TableCell>
                        <span className={`font-mono text-sm font-bold ${(job.score || 0) >= 80 ? "text-green-500" : (job.score || 0) >= 70 ? "text-yellow-500" : "text-muted-foreground"}`}>
                          {job.score ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[job.status]?.variant || "outline"}>
                          {statusConfig[job.status]?.label || job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(job.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {(job.status === "pending" || job.status === "approved") && !job.tailored_resume_text && (
                            <Button size="sm" variant="outline" className="gap-1" disabled={generatingDocs === job.id} onClick={() => generateDocs(job)}>
                              {generatingDocs === job.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                              Generate
                            </Button>
                          )}
                          {job.tailored_resume_text && (
                            <Button size="sm" variant="ghost" className="gap-1" disabled={generatingDocs === job.id} onClick={() => generateDocs(job)}>
                              {generatingDocs === job.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                              Regen
                            </Button>
                          )}
                          {job.tailored_resume_text && (
                            <>
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => setPreviewJob(job)}>
                                <FileText className="h-3 w-3" /> Preview
                              </Button>
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadAsPDF(job.tailored_resume_text!, `Resume_${job.company}_${job.title}`)}>
                                <Download className="h-3 w-3" /> Resume
                              </Button>
                              {job.cover_letter_text && (
                                <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadAsPDF(job.cover_letter_text!, `CoverLetter_${job.company}_${job.title}`)}>
                                  <Download className="h-3 w-3" /> Cover
                                </Button>
                              )}
                            </>
                          )}
                          {job.status === "pending" && (
                            <>
                              <Button size="sm" variant="default" onClick={() => updateJobStatus(job.id, "approved")}>Approve</Button>
                              <Button size="sm" variant="ghost" onClick={() => updateJobStatus(job.id, "skipped")}>Skip</Button>
                            </>
                          )}
                          {job.url && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={job.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}>
                            {expandedJob === job.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedJob === job.id && (
                      <TableRow key={`${job.id}-exp`}>
                        <TableCell colSpan={7} className="bg-muted/20 p-4">
                          <div className="space-y-3 text-sm">
                            {job.company_description && (
                              <div>
                                <p className="font-semibold mb-1">About {job.company}</p>
                                <p className="text-muted-foreground">{job.company_description}</p>
                              </div>
                            )}
                            {job.description && (
                              <div>
                                <p className="font-semibold mb-1">Job Description</p>
                                <p className="text-muted-foreground whitespace-pre-wrap">{job.description.substring(0, 800)}{job.description.length > 800 ? "..." : ""}</p>
                              </div>
                            )}
                            {job.salary_info && <p><span className="font-semibold">Salary:</span> {job.salary_info}</p>}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {previewJob && (
        <Dialog open={!!previewJob} onOpenChange={() => setPreviewJob(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{previewJob.title} at {previewJob.company}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="resume" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="shrink-0">
                <TabsTrigger value="resume">Resume</TabsTrigger>
                {previewJob.cover_letter_text && <TabsTrigger value="cover">Cover Letter</TabsTrigger>}
              </TabsList>
              <TabsContent value="resume" className="flex-1 overflow-auto mt-2">
                <div className="flex justify-end gap-2 mb-3">
                  <Button size="sm" className="gap-1" onClick={() => downloadAsPDF(previewJob.tailored_resume_text!, `Resume_${previewJob.company}_${previewJob.title}`)}>
                    <Download className="h-3 w-3" /> Download PDF
                  </Button>
                </div>
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg leading-relaxed font-mono">{previewJob.tailored_resume_text}</pre>
              </TabsContent>
              {previewJob.cover_letter_text && (
                <TabsContent value="cover" className="flex-1 overflow-auto mt-2">
                  <div className="flex justify-end gap-2 mb-3">
                    <Button size="sm" className="gap-1" onClick={() => downloadAsPDF(previewJob.cover_letter_text!, `CoverLetter_${previewJob.company}_${previewJob.title}`)}>
                      <Download className="h-3 w-3" /> Download PDF
                    </Button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg leading-relaxed font-mono">{previewJob.cover_letter_text}</pre>
                </TabsContent>
              )}
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}