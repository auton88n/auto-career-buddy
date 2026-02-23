import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Briefcase, CheckCircle, Clock, AlertTriangle, Search, Loader2,
  ExternalLink, ThumbsUp, SkipForward,
} from "lucide-react";
import { jobsApi, JobListing } from "@/lib/api/jobs";
import { useToast } from "@/hooks/use-toast";

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending", variant: "default" },
    approved: { label: "Approved", variant: "secondary" },
    applied: { label: "Applied", variant: "secondary" },
    skipped: { label: "Skipped", variant: "outline" },
    manual_required: { label: "Manual", variant: "destructive" },
    rejected: { label: "Rejected", variant: "outline" },
  };
  const config = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const Index = () => {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, applied: 0, manual_required: 0 });
  const [loading, setLoading] = useState(true);

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
    toast({ title: "Scanning for jobs...", description: "This may take a minute." });
    try {
      const result = await jobsApi.scanJobs();
      if (result.success) {
        toast({
          title: "Scan complete",
          description: `Found ${result.jobs_found} results, saved ${result.jobs_saved} new jobs.`,
        });
        await loadData();
      } else {
        toast({ title: "Scan failed", description: result.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Scan error", description: e.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
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
    { label: "Applied", value: counts.applied, icon: CheckCircle, color: "text-success" },
    { label: "Pending", value: counts.pending, icon: Clock, color: "text-primary" },
    { label: "Manual Required", value: counts.manual_required, icon: AlertTriangle, color: "text-warning" },
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
          <Button className="gap-2" onClick={handleScan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {scanning ? "Scanning..." : "Scan Now"}
          </Button>
        </div>

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
                        <TableCell>{statusBadge(job.status)}</TableCell>
                        <TableCell className="text-right">
                          {job.status === "pending" && (
                            <div className="flex justify-end gap-1">
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
                            </div>
                          )}
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
    </div>
  );
};

export default Index;
