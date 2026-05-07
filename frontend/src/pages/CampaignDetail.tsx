import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  ExternalLink,
  Pencil,
  Check,
  X,
  ChevronRight,
  Users,
  Sparkles,
  Reply,
  TrendingUp,
  Clock,
  Calendar,
  Globe,
  Copy,
  CheckCheck,
  MessageSquare,
  Send,
  Layers,
  Settings2,
  FileText,
  LayoutDashboard,
  AlertCircle,
  Mail,
  Target,
  BarChart3,
  Zap,
} from "lucide-react";
import { fetchCampaign, updateCampaign, fetchProspects } from "../lib/api";
import type { Prospect } from "../lib/api";

// ----- Helpers -----

const DAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

function formatTime(raw: string): string {
  const [h, m] = raw.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

const STATUS_COLORS: Record<string, string> = {
  uploaded:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  pending:
    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  generating:
    "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  generated:
    "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  sending:
    "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  sent: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  replied:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  error:
    "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800",
  bounced:
    "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  uploaded: "bg-slate-400",
  pending: "bg-amber-400",
  generating: "bg-purple-400 animate-pulse",
  generated: "bg-blue-400",
  sending: "bg-orange-400 animate-pulse",
  sent: "bg-teal-400",
  replied: "bg-emerald-400",
  error: "bg-red-400",
  bounced: "bg-rose-400",
};

function statusBadgeClasses(status: string) {
  return (
    STATUS_COLORS[status] ||
    "bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-300 border-gray-200 dark:border-gray-700"
  );
}

type Tab = "overview" | "config" | "prompt" | "prospects";

const TABS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "config", label: "Configuration", icon: Settings2 },
  { key: "prompt", label: "AI Prompt", icon: FileText },
  { key: "prospects", label: "Prospects", icon: Users },
];

// ----- Animated Counter Hook -----
function useCountUp(end: number, duration = 1000, start = 0) {
  const [value, setValue] = useState(start);
  const raf = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    const animate = (now: number) => {
      if (!startTime.current) startTime.current = now;
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        raf.current = requestAnimationFrame(animate);
      }
    };
    raf.current = requestAnimationFrame(animate);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [end, duration, start]);

  return value;
}

// ----- Clean metric card -----
function MetricCard({
  value,
  label,
  colorClass,
  icon: Icon,
  delay = 0,
}: {
  value: number;
  label: string;
  colorClass: string;
  icon: typeof Users;
  delay?: number;
}) {
  const animated = useCountUp(value, 1200);
  return (
    <div
      className="rounded-xl border border-border/60 bg-card p-5 transition-all duration-300 hover:border-border hover:shadow-sm"
      style={{ animation: `fadeSlideUp 0.4s ease-out ${delay}ms both` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <div
          className={`p-2 rounded-lg bg-gradient-to-br ${colorClass.includes("emerald") ? "from-emerald-500/15 to-emerald-500/5 text-emerald-600" : colorClass.includes("blue") ? "from-blue-500/15 to-blue-500/5 text-blue-600" : colorClass.includes("teal") ? "from-teal-500/15 to-teal-500/5 text-teal-600" : "from-primary/15 to-primary/5 text-primary"}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={`text-3xl font-bold tabular-nums tracking-tight ${colorClass}`}>
        {animated.toLocaleString()}
      </p>
    </div>
  );
}

// ----- Clean circular progress -----
function CircularProgress({
  pct,
  size = 150,
  strokeWidth = 8,
}: {
  pct: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference;
  const animatedPct = useCountUp(Math.round(pct * 10) / 10, 1500, 0);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted-foreground/15"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-emerald-500 transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-foreground">
          {animatedPct}%
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">
          Reply Rate
        </span>
      </div>
    </div>
  );
}

// ----- Skeleton loader -----
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-muted/50 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-background/20 to-transparent" />
    </div>
  );
}

// ----- Main component -----

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { data, isLoading, error } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => fetchCampaign(id!),
    enabled: !!id,
  });

  const campaign = data?.data;

  const { data: prospectsData, isLoading: prospectsLoading } = useQuery({
    queryKey: ["prospects", { campaignId: id }],
    queryFn: () => fetchProspects({ campaignId: id!, limit: "50" }),
    enabled: !!id,
  });

  const prospects: Prospect[] = prospectsData?.data ?? [];

  // ----- Prompt editing state -----
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  const promptMut = useMutation({
    mutationFn: (prompt: string) => updateCampaign(id!, { prompt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", id] });
      setEditingPrompt(false);
    },
  });

  const handleSavePrompt = () => {
    promptMut.mutate(editPrompt);
  };

  const handleCopyPrompt = async () => {
    if (!campaign?.prompt) return;
    await navigator.clipboard.writeText(campaign.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Insert variable into prompt textarea
  const insertVariable = useCallback(
    (variable: string) => {
      if (!editingPrompt) return;
      setEditPrompt((prev) => prev + variable);
    },
    [editingPrompt],
  );

  // ----- Loading state -----
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ----- Error state -----
  if (error || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <div className="p-5 rounded-2xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">
            Failed to load campaign
          </p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
            The campaign may have been deleted or you may not have access.
          </p>
        </div>
        <button
          onClick={() => navigate("/campaigns")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </button>
      </div>
    );
  }

  // ----- Derived values -----
  const totalProspects = campaign.prospectCount ?? 0;
  const totalReplied = campaign.repliedCount ?? 0;
  const replyRate =
    totalProspects > 0 ? (totalReplied / totalProspects) * 100 : 0;

  // Cumulative counts (prospects that have passed through a milestone)
  const generatedCount = campaign.generatedCount ?? 0;
  const sentCount = campaign.sentCount ?? 0;

  // ----- Tab indicator position -----
  const activeTabIndex = TABS.findIndex((t) => t.key === activeTab);

  // ----- Render -----
  return (
    <div className="space-y-6 max-w-5xl">
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-in {
          animation: fadeSlideUp 0.35s ease-out both;
        }
      `}</style>

      {/* --- Back navigation --- */}
      <button
        onClick={() => navigate("/campaigns")}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        style={{ animation: "fadeSlideUp 0.4s ease-out both" }}
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Campaigns
      </button>

      {/* ====== HERO BANNER ====== */}
      <div
        className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8"
        style={{ animation: "fadeSlideUp 0.4s ease-out 0.1s both" }}
      >
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              {campaign.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/50">
                <Layers className="h-3.5 w-3.5" />
                <span className="font-medium">{campaign.stepCount}</span>
                <span>step{campaign.stepCount !== 1 ? "s" : ""}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Created{" "}
                {new Date(campaign.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {campaign.timezone || "Asia/Kolkata"}
              </span>
              {(() => {
                const cs = campaign.status || (campaign.isActive ? "active" : "draft");
                const badgeStyle =
                  cs === "active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                    : cs === "paused"
                      ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800";
                const dotStyle =
                  cs === "active"
                    ? "bg-emerald-500 animate-pulse"
                    : cs === "paused"
                      ? "bg-orange-500"
                      : "bg-amber-500";
                const label = cs === "active" ? "Active" : cs === "paused" ? "Paused" : "Draft";
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badgeStyle}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${dotStyle}`} />
                    {label}
                  </span>
                );
              })()}
            </div>
          </div>
          <a
            href={`https://app.instantly.ai/app/campaign/${campaign.instantlyCampaignId}/analytics`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all"
          >
            <ExternalLink className="h-4 w-4" />
            Open in Instantly
          </a>
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-7">
          <MetricCard
            value={totalProspects}
            label="Prospects"
            colorClass="text-foreground"
            icon={Target}
            delay={200}
          />
          <MetricCard
            value={totalReplied}
            label="Replied"
            colorClass="text-emerald-600 dark:text-emerald-400"
            icon={Reply}
            delay={300}
          />
          <MetricCard
            value={generatedCount}
            label="Generated"
            colorClass="text-blue-600 dark:text-blue-400"
            icon={Zap}
            delay={400}
          />
          <MetricCard
            value={sentCount}
            label="Sent"
            colorClass="text-teal-600 dark:text-teal-400"
            icon={Mail}
            delay={500}
          />
        </div>
      </div>

      {/* ====== TAB NAVIGATION ====== */}
      <div>
        <div className="flex p-1.5 bg-muted/50 rounded-xl overflow-x-auto relative">
          {/* Sliding background indicator */}
          <div
            className="absolute top-1.5 bottom-1.5 rounded-lg bg-background shadow-sm border border-border/40 transition-all duration-300 ease-out"
            style={{
              left: `${activeTabIndex * 25}%`,
              width: `${100 / TABS.length}%`,
            }}
          />
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative z-10 flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === key
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {key === "prospects" && (
                <span
                  className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold transition-colors ${
                    activeTab === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted-foreground/15 text-muted-foreground"
                  }`}
                >
                  {totalProspects}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ====== TAB CONTENT ====== */}

      {/* --- OVERVIEW TAB --- */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in">
          {/* Reply Rate Section */}
          <div className="rounded-2xl border border-border/60 bg-card p-8">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <CircularProgress pct={replyRate} size={160} strokeWidth={8} />
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-lg font-bold flex items-center justify-center md:justify-start gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                  </div>
                  Reply Rate Progress
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-lg tabular-nums">
                    {totalReplied}
                  </span>{" "}
                  out of{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {totalProspects}
                  </span>{" "}
                  prospects have replied
                </p>
                <div className="mt-5 w-full">
                  <div className="w-full h-3 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-emerald-400 to-emerald-500"
                      style={{ width: `${Math.min(replyRate, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-[11px] font-semibold text-muted-foreground">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* --- CONFIG TAB --- */}
      {activeTab === "config" && (
        <div className="animate-in">
          <div className="rounded-2xl border border-border/60 bg-card p-8">
            <h3 className="text-lg font-bold flex items-center gap-2.5 mb-6">
              <div className="p-2 rounded-lg bg-primary/5">
                <Settings2 className="h-5 w-5 text-primary" />
              </div>
              Campaign Configuration
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Timezone */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-muted/20">
                <div className="p-2.5 rounded-lg bg-blue-500/10 shrink-0">
                  <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                    Timezone
                  </p>
                  <p className="text-sm font-semibold truncate">
                    {campaign.timezone || "Asia/Kolkata"}
                  </p>
                </div>
              </div>

              {/* Schedule */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-muted/20">
                <div className="p-2.5 rounded-lg bg-purple-500/10 shrink-0">
                  <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                    Schedule
                  </p>
                  <p className="text-sm font-semibold">
                    {campaign.scheduleName || "Business Hours"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(campaign.timingFrom || "09:00")} –{" "}
                    {formatTime(campaign.timingTo || "17:00")}
                  </p>
                </div>
              </div>

              {/* Active Days */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-muted/20">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 shrink-0">
                  <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                    Active Days
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(campaign.days || [1, 2, 3, 4, 5]).map((d: number) => (
                      <span
                        key={d}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold border border-primary/10"
                      >
                        {DAY_LABELS[d]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Delay */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-muted/20">
                <div className="p-2.5 rounded-lg bg-amber-500/10 shrink-0">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                    Delay Between Steps
                  </p>
                  <p className="text-sm font-semibold">
                    {campaign.delayBetweenSteps ?? 1}{" "}
                    <span className="text-muted-foreground font-medium">
                      {campaign.delayUnit || "days"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Steps */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-muted/20">
                <div className="p-2.5 rounded-lg bg-rose-500/10 shrink-0">
                  <Layers className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                    Total Steps
                  </p>
                  <p className="text-sm font-semibold">
                    {campaign.stepCount} step
                    {campaign.stepCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- PROMPT TAB --- */}
      {activeTab === "prompt" && (
        <div className="animate-in">
          <div className="rounded-2xl border border-border/60 bg-card p-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                </div>
                AI Prompt
              </h3>
              {!editingPrompt ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyPrompt}
                    disabled={!campaign.prompt}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 px-3 py-2 rounded-lg hover:bg-muted"
                  >
                    {copied ? (
                      <>
                        <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />{" "}
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditPrompt(campaign.prompt || "");
                      setEditingPrompt(true);
                    }}
                    className="inline-flex items-center gap-2 text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 px-4 py-2.5 rounded-lg transition-all"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit Prompt
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSavePrompt}
                    disabled={promptMut.isPending}
                    className="inline-flex items-center gap-2 text-xs font-semibold bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {promptMut.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingPrompt(false)}
                    className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-lg border hover:bg-muted transition-all"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                </div>
              )}
            </div>

            {editingPrompt ? (
              <div>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border bg-background px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-y leading-relaxed"
                  placeholder="Write a personalized cold email for a {{role}} at {{company}}..."
                />
                <div className="mt-2 text-[10px] text-muted-foreground text-right font-mono">
                  {editPrompt.length} chars
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/20 border p-5">
                <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed text-foreground">
                  {campaign.prompt || (
                    <span className="text-muted-foreground italic">
                      No prompt configured yet. Click "Edit Prompt" to add one.
                    </span>
                  )}
                </pre>
              </div>
            )}

            {/* Variable hints */}
            <div className="mt-5">
              <p className="text-[10px] font-bold text-muted-foreground mb-3 uppercase tracking-wide">
                Available Variables
                {editingPrompt && (
                  <span className="ml-1 font-normal normal-case tracking-normal text-[10px]">
                    — click to insert
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "{{name}}",
                  "{{company}}",
                  "{{role}}",
                  "{{notes}}",
                  "{{painPoints}}",
                ].map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    className={`text-xs px-3 py-1.5 rounded-lg bg-primary/5 text-primary font-mono font-semibold border border-primary/15 transition-all ${
                      editingPrompt
                        ? "hover:bg-primary hover:text-primary-foreground cursor-pointer"
                        : "cursor-default"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- PROSPECTS TAB --- */}
      {activeTab === "prospects" && (
        <div className="animate-in">
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
              <h3 className="text-lg font-bold flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/5">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                Prospects
                <span className="text-sm font-medium text-muted-foreground ml-1.5">
                  ({totalProspects})
                </span>
              </h3>
              {prospectsData?.pagination &&
                prospectsData.pagination.total > prospects.length && (
                  <Link
                    to={`/prospects?campaignId=${id}`}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1.5 group"
                  >
                    View all {prospectsData.pagination.total}
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
            </div>

            {prospectsLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-3">
                    <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-7 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : prospects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4">
                <div className="p-5 rounded-xl bg-muted/50">
                  <Users className="h-10 w-10 opacity-30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">
                    No prospects in this campaign yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload prospects to get started
                  </p>
                </div>
                <Link
                  to="/upload"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all mt-2"
                >
                  <Users className="h-4 w-4" /> Upload Prospects
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {prospects.map((p) => {
                  const totalSteps = campaign.stepCount || 0;
                  const stepLabel =
                    totalSteps > 0 && p.currentStep > 0
                      ? `Step ${p.currentStep}/${totalSteps}`
                      : p.currentStep > 0
                        ? `Step ${p.currentStep}`
                        : null;

                  const hasReply =
                    p.reply_text && p.reply_text.trim().length > 0;

                  return (
                    <Link
                      key={p._id}
                      to={`/prospects/${p._id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors group"
                    >
                      {/* Avatar */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/20">
                        {(p.name || p.email)[0].toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {p.name || p.email}
                          </p>
                          {p.name && (
                            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                              {p.email}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {p.company && (
                            <span className="text-xs text-muted-foreground font-medium">
                              {p.company}
                            </span>
                          )}
                          {p.role && (
                            <>
                              {p.company && (
                                <span className="text-[10px] text-muted-foreground/40">
                                  ·
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {p.role}
                              </span>
                            </>
                          )}
                          {stepLabel && (
                            <>
                              <span className="text-[10px] text-muted-foreground/40">
                                ·
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md">
                                <Layers className="h-3 w-3" />
                                {stepLabel}
                              </span>
                            </>
                          )}
                        </div>
                        {hasReply && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate mt-1.5 flex items-center gap-1.5 bg-emerald-500/5 px-2 py-0.5 rounded-md max-w-fit">
                            <MessageSquare className="h-3 w-3 shrink-0" />
                            {p.reply_text}
                          </p>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        {p.forwardedToSales && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 font-bold border border-green-200 dark:border-green-800">
                            <Send className="h-2.5 w-2.5" /> Sales
                          </span>
                        )}
                        {p.repliedToStep != null && p.repliedToStep > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                            <Reply className="h-2.5 w-2.5" /> Step {p.repliedToStep}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold border ${statusBadgeClasses(p.status)}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[p.status] || "bg-gray-400"}`}
                          />
                          {p.status}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}