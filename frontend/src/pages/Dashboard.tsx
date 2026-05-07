import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users,
  Megaphone,
  Mail,
  MessageSquare,
  Clock,
  ChevronRight,
  Loader2,
  Rocket,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchStats, type StatsOverview } from "../lib/api";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value ?? 0}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 15_000,
  });

  const stats: StatsOverview | undefined = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-destructive font-medium">Failed to load stats</p>
        <p className="text-sm text-muted-foreground">{(error as Error)?.message}</p>
      </div>
    );
  }

  const chartData = stats.perCampaign?.slice(0, 10) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your cold email campaigns</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3">
        <StatCard label="Prospects" value={stats.totalProspects} icon={Users} color="bg-blue-500" />
        <StatCard label="Campaigns" value={stats.totalCampaigns} icon={Megaphone} color="bg-violet-500" />
        <StatCard label="Pending" value={stats.pending} icon={Clock} color="bg-amber-500" />
        <StatCard label="Generated" value={stats.generatedCount} icon={Mail} color="bg-emerald-500" />
        <StatCard label="Pushed" value={stats.pushedCount} icon={Rocket} color="bg-sky-500" />
        <StatCard label="Sent" value={stats.sentCount} icon={Mail} color="bg-blue-500" />
        <StatCard label="Replied" value={stats.replied} icon={MessageSquare} color="bg-rose-500" />
      </div>

      {/* Campaign breakdown chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold mb-4">Prospects per Campaign</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="campaignName" width={130} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(221.2, 83.2%, 53.3%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent activity */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Recent Activity</h3>
          <Link to="/prospects" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {stats.recentActivity?.length ? (
          <div className="divide-y">
            {stats.recentActivity.map((p) => (
              <div key={p._id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{p.name || p.email}</p>
                  <p className="text-xs text-muted-foreground">{p.company || p.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  {p.campaignName && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">{p.campaignName}</span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      p.status === "replied"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.status === "replied" && <MessageSquare className="h-3 w-3" />}
                    {p.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No recent activity</p>
        )}
      </div>
    </div>
  );
}