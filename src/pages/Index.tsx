import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Briefcase, CheckCircle, Clock, AlertTriangle, Search, Loader2,
  ExternalLink, ThumbsUp, SkipForward, FileText, Copy, Send,
  FileCheck, Download, Printer,
} from "lucide-react";
import { jobsApi, JobListing } from "@/lib/api/jobs";
import { useToast } from "@/hooks/use-toast";

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    pending: { label: "Pending", variant: "default" },
    approved: { label: "Approved", variant: "secondary" },
    applied: { label: "Applied", variant: "secondary" },
    skipped: { label: "Skipped", variant: "outline" },
    manual_required: { label: "Manual", variant: "destructive" },
    rejected: { label: "Rejected", variant: "outline" },
    generating_docs: { label: "Generating...", variant: "outline", className: "border-info text-info animate-pulse" },
    ready_to_apply: { label: "Ready", variant: "outline", className: "border-success text-success" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const config = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
};

function generatePrintableHTML(content: string, title: string, jobTitle: string, company: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; padding: 40px 60px; color: #1a1a1a; line-height: 1.6; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; color: #111; }
  h2 { font-size: 16px; margin-top: 20px; margin-bottom: 8px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 14px; margin-top: 12px; margin-bottom: 4px; color: #444; }
  p { margin-bottom: 8px; font-size: 13px; }
  ul { margin-left: 20px; margin-bottom: 8px; }
  li { font-size: 13px; margin-bottom: 4px; }
  .header-meta { font-size: 12px; color: #666; margin-bottom: 20px; }
  @media print {
    body { padding: 20px 40px; }
    @page { margin: 0.5in; }
  }
</style></head>
<body>
<div class="header-meta">Tailored for: ${jobTitle} at ${company}</div>
${content.split('\n').map(line => {
    if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
    if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
    if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
    if (line.startsWith('- ') || line.startsWith('• ')) return `<li>${line.slice(2)}</li>`;
    if (line.startsWith('* ')) return `<li>${line.slice(2)}</li>`;
    if (line.trim() === '') return '<br/>';
    return `<p>${line}</p>`;
  }).join('\n')}
</body></html>`;
}

function openPrintableDocument(content: string, title: string, jobTitle: string, company: string) {
  const html = generatePrintableHTML(content, title, jobTitle, company);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

const Index = () => {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [scanProgress, setScanProgress] = useState<string | null>(null);
  const [applyProgress, setApplyProgress] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [counts, setCounts] = useState({
    total: 0, pending: 0, applied: 0, approved: 0,
    manual_required: 0, generating_docs: 0, ready_to_apply: 0, failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [docsDialog, setDocsDialog] = useState<{ open: boolean; job: JobListing | null; resume: string | null; coverLetter: string | null }>({
    open: false, job: null, resume: null, coverLetter: null,
  });

  const loadData = useCallback(async () => {
    try {
      const [jobsData, countsData] = await Promise.all([
        jobsApi.getJobs(),
        jobsApi.getJobCounts(),
      ]);
      setJobs(jobsData);
      setCounts(countsData);
    } catch (e) {
      console.error("Failed to load jobs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScan = async () => {
    setScanning(true);
    setScanProgress("Searching for jobs...");
    try {
      const result = await jobsApi.scanJobs();
      if (result.success) {
        toast({
          title: "Scan complete!",
          description: result.message || `Found ${result.jobs_saved} new jobs.`,
        });
        setScanProgress(null);
        await loadData();
      } else {
        toast({ title: "Scan failed", description: result.error, variant: "destructive" });
        setScanProgress(null);
      }
    } catch (e: any) {
      toast({ title: "Scan error", description: e.message, variant: "destructive" });
      setScanProgress(null);
    } finally {
      setScanning(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setApplyProgress("Generating tailored documents...");
    try {
      const result = await jobsApi.applyToJobs();
      if (result.success) {
        toast({
          title: "Documents generated!",
          description: result.message || "Your tailored resume and cover letter are ready.",
        });
        setApplyProgress(null);
        await loadData();
      } else {
        toast({ title: "Apply failed", description: result.error, variant: "destructive" });
        setApplyProgress(null);
      }
    } catch (e: any) {
      toast({ title: "Apply error", description: e.message, variant: "destructive" });
      setApplyProgress(null);
    } finally {
      setApplying(false);
    }
  };

  const handleViewDocs = async (job: JobListing) => {
    try {
      const docs = await jobsApi.getApplicationDocs(job.id);
      setDocsDialog({ open: true, job, resume: docs.resume, coverLetter: docs.coverLetter });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await jobsApi.updateJobStatus(id, status);
      await loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const stats = [
    { label: "Jobs Found", value: counts.total, icon: Briefcase, color: "text-info" },
    { label: "Pending", value: counts.pending, icon: Clock, color: "text-primary" },
    { label: "Approved", value: counts.approved, icon: ThumbsUp, color: "text-warning" },
    { label: "Ready", value: counts.ready_to_apply, icon: FileCheck, color: "text-success" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Your job application pipeline at a glance</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleApply} disabled={applying || counts.approved === 0}>
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {applying ? "Generating..." : `Batch Apply (${counts.approved})`}
            </Button>
            <Button className="gap-2" onClick={handleScan} disabled={scanning}>
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {scanning ? "Scanning..." : "Scan Now"}
            </Button>
          </div>
        </div>

        {/* Progress indicators */}
        {(scanProgress || applyProgress) && (
          <Card className="mb-4 border-info/30 bg-info/5">
            <CardContent className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-info" />
              <div>
                <p className="font-medium text-sm">{scanProgress || applyProgress}</p>
                <p className="text-xs text-muted-foreground">This may take a minute, please wait...</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono">
                  {loading ? "—" : stat.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Job Listings</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Briefcase className="mx-auto mb-3 h-10 w-10 opacity-30" />
                  <p>No jobs discovered yet</p>
                  <p className="mt-1 text-sm">Click "Scan Now" to start finding jobs</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Company Info</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">{job.company}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {job.title}
                            {job.url && (
                              <a
                                href={job.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm font-semibold">{job.score}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {job.location || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[200px]">
                          {job.company_description ? (
                            <span title={job.company_description}>
                              {job.company_description.length > 80
                                ? job.company_description.substring(0, 80) + "…"
                                : job.company_description}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{statusBadge(job.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {job.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleStatusUpdate(job.id, "approved")}
                                  title="Approve"
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleStatusUpdate(job.id, "skipped")}
                                  title="Skip"
                                >
                                  <SkipForward className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {(job.status === "ready_to_apply" || job.status === "applied" || job.status === "failed") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleViewDocs(job)}
                                title="View Documents"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}
                            {job.status === "ready_to_apply" && job.url && (
                              <a href={job.url} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Open Job URL">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </a>
                            )}
                            {job.status === "generating_docs" && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Documents Dialog */}
      <Dialog open={docsDialog.open} onOpenChange={(open) => setDocsDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {docsDialog.job ? `${docsDialog.job.title} at ${docsDialog.job.company}` : "Documents"}
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="resume" className="mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="resume">Tailored Resume</TabsTrigger>
              <TabsTrigger value="cover">Cover Letter</TabsTrigger>
            </TabsList>
            <TabsContent value="resume">
              <div className="flex justify-end gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => docsDialog.resume && copyToClipboard(docsDialog.resume, "Resume")}
                  disabled={!docsDialog.resume}
                >
                  <Copy className="h-3 w-3" /> Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => docsDialog.resume && docsDialog.job && openPrintableDocument(
                    docsDialog.resume, "Resume", docsDialog.job.title, docsDialog.job.company
                  )}
                  disabled={!docsDialog.resume}
                >
                  <Printer className="h-3 w-3" /> Print / Save PDF
                </Button>
              </div>
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                  {docsDialog.resume || "No resume generated yet."}
                </pre>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="cover">
              <div className="flex justify-end gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => docsDialog.coverLetter && copyToClipboard(docsDialog.coverLetter, "Cover letter")}
                  disabled={!docsDialog.coverLetter}
                >
                  <Copy className="h-3 w-3" /> Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => docsDialog.coverLetter && docsDialog.job && openPrintableDocument(
                    docsDialog.coverLetter, "Cover Letter", docsDialog.job.title, docsDialog.job.company
                  )}
                  disabled={!docsDialog.coverLetter}
                >
                  <Printer className="h-3 w-3" /> Print / Save PDF
                </Button>
              </div>
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                  {docsDialog.coverLetter || "No cover letter generated yet."}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
