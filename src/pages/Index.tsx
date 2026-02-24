import { useEffect, useState } from "react";
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

async function downloadAsPDF(text: string, filename: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 19;
  const mR = 19;
  const mT = 20;
  const mB = 18;
  const cW = pageW - mL - mR;
  let y = mT;
  let lineNum = 0; // tracks non-empty lines written

  const newPage = () => { doc.addPage(); y = mT; };
  const checkY = (n: number) => { if (y + n > pageH - mB) newPage(); };

  const rawLines = text.split("\n");

  for (const raw of rawLines) {
    const line = raw.trim();

    if (line === "" || line === "---") {
      y += 2.5;
      continue;
    }

    // LINE 1: Candidate name — large, bold, black
    if (lineNum === 0) {
      checkY(14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(15, 15, 15);
      doc.text(line, mL, y);
      y += 9;
      lineNum++;
      continue;
    }

    // LINE 2: Professional title/subtitle — medium, normal, dark grey
    if (lineNum === 1 && !line.includes("@") && !line.includes("+966") && !line.includes("+1")) {
      checkY(7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      doc.text(line, mL, y);
      y += 6;
      lineNum++;
      continue;
    }

    // Contact line — small, grey
    if (line.includes("@") || line.includes("+966") || line.includes("+1 (") || (lineNum <= 3 && line.includes("•") && line.includes("."))) {
      checkY(6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(90, 90, 90);
      const wrapped = doc.splitTextToSize(line, cW);
      wrapped.forEach((wl: string) => { checkY(5); doc.text(wl, mL, y); y += 4.5; });
      lineNum++;
      continue;
    }

    // Section headers: ALL CAPS or **bold** markers
    const boldMatch = line.match(/^\*\*(.+?)\*\*\s*:?\s*$/);
    const isHeader = boldMatch || (
      line === line.toUpperCase() &&
      line.replace(/[^A-Z]/g, "").length > 2 &&
      !line.startsWith("•") &&
      !line.startsWith("-") &&
      line.length < 60
    );

    if (isHeader) {
      const hText = boldMatch ? boldMatch[1].toUpperCase() : line;
      y += 3;
      checkY(9);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 15, 15);
      doc.text(hText, mL, y);
      doc.setDrawColor(15, 15, 15);
      doc.setLineWidth(0.35);
      doc.line(mL, y + 1.2, pageW - mR, y + 1.2);
      y += 6.5;
      lineNum++;
      continue;
    }

    // Job title lines: "Title | Company | Dates"
    if (line.includes(" | ") && !line.startsWith("•") && !line.startsWith("-")) {
      y += 1;
      checkY(7);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      const wrapped = doc.splitTextToSize(line, cW);
      wrapped.forEach((wl: string) => { checkY(6); doc.text(wl, mL, y); y += 5.2; });
      lineNum++;
      continue;
    }

    // Bullet points
    if (line.startsWith("•") || line.startsWith("-")) {
      checkY(5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(35, 35, 35);
      const bText = line.replace(/^[•\-]\s*/, "");
      const wrapped = doc.splitTextToSize(bText, cW - 6);
      doc.text("•", mL + 1, y);
      wrapped.forEach((wl: string, wi: number) => {
        checkY(5);
        doc.text(wl, mL + 6, y);
        if (wi < wrapped.length - 1) y += 4.8;
      });
      y += 5;
      lineNum++;
      continue;
    }

    // Normal text
    checkY(5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(35, 35, 35);
    const wrapped = doc.splitTextToSize(line, cW);
    wrapped.forEach((wl: string) => { checkY(5); doc.text(wl, mL, y); y += 4.8; });
    lineNum++;
  }

  doc.save(`${filename}.pdf`);
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