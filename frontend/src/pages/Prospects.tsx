import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Clock,
  MessageSquare,
  Send,
  Rocket,
} from "lucide-react";
import { fetchProspects } from "../lib/api";

const statusIcons: Record<string, React.ElementType> = {
  pending: Clock,
  generated: Mail,
  pushed: Rocket,
  sent: Send,
  replied: MessageSquare,
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  generated: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  pushed: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  replied: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

export default function Prospects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const page = parseInt(searchParams.get("page") || "1");
  const status = searchParams.get("status") || "";
  const campaignId = searchParams.get("campaignId") || "";

  const queryParams: Record<string, string> = { page: String(page), limit: "25" };
  if (search) queryParams.search = search;
  if (status) queryParams.status = status;
  if (campaignId) queryParams.campaignId = campaignId;

  const { data, isLoading } = useQuery({
    queryKey: ["prospects", queryParams],
    queryFn: () => fetchProspects(queryParams),
    placeholderData: (prev) => prev,
  });

  const prospects = data?.data || [];
  const pag = data?.pagination;

  const applySearch = () => {
    const p = new URLSearchParams(searchParams);
    if (search) p.set("search", search);
    else p.delete("search");
    p.set("page", "1");
    setSearchParams(p);
  };

  const setPage = (p: number) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("page", String(p));
    setSearchParams(sp);
  };

  const toggleStatus = (s: string) => {
    const sp = new URLSearchParams(searchParams);
    if (status === s) sp.delete("status");
    else sp.set("status", s);
    sp.set("page", "1");
    setSearchParams(sp);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Prospects</h2>
        <p className="text-muted-foreground">Search, filter, and manage your prospects</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="Search by email, name, or company..."
              className="w-full pl-9 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={applySearch}
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            Search
          </button>
        </div>
        {["pending", "generated", "pushed", "sent", "replied"].map((s) => {
          const Icon = statusIcons[s] || Clock;
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                status === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              }`}
            >
              <Icon className="h-3 w-3" />
              {s.replace(/_/g, " ")}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : prospects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Mail className="h-12 w-12" />
          <p>No prospects found</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">Name / Email</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Company</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Campaign</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {prospects.map((p) => {
                    const Icon = statusIcons[p.status] || Clock;
                    return (
                      <tr key={p._id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <Link to={`/prospects/${p._id}`} className="hover:text-primary">
                            <p className="font-medium truncate max-w-[200px]">{p.name || p.email}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.email}</p>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                          {p.company || "-"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {p.campaignId ? (
                            <Link
                              to={`/campaigns/${p.campaignId}`}
                              className="hover:text-primary transition-colors"
                            >
                              {p.campaignName || p.campaignId}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                              statusColors[p.status] || "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Icon className="h-3 w-3" />
                            {p.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/prospects/${p._id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pag && pag.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Showing {prospects.length} of {pag.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-muted-foreground">
                  {page} / {pag.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pag.totalPages}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}