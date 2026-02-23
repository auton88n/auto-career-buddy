import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, CheckCircle, Clock, AlertTriangle, Search } from "lucide-react";

const stats = [
  { label: "Jobs Found", value: "0", icon: Briefcase, color: "text-info" },
  { label: "Applied", value: "0", icon: CheckCircle, color: "text-success" },
  { label: "Pending", value: "0", icon: Clock, color: "text-primary" },
  { label: "Manual Required", value: "0", icon: AlertTriangle, color: "text-warning" },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Your job application pipeline at a glance</p>
          </div>
          <Button className="gap-2">
            <Search className="h-4 w-4" />
            Scan Now
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
                <div className="text-3xl font-bold font-mono">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Briefcase className="mx-auto mb-3 h-10 w-10 opacity-30" />
                <p>No jobs discovered yet</p>
                <p className="mt-1 text-sm">Click "Scan Now" to start finding jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Index;
