import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  ChevronRight,
  Loader2,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  Zap,
} from "lucide-react";
import { fetchCampaigns, createCampaign } from "../lib/api";

// ----- Schemas -----
const createSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required"),
  prompt: z.string().trim().min(1, "Prompt is required"),
  stepCount: z.string(),
  timezone: z.string(),
  scheduleName: z.string(),
  timingFrom: z.string(),
  timingTo: z.string(),
  days: z.array(z.number()),
  delayBetweenSteps: z.string(),
  delayUnit: z.enum(["minutes", "hours", "days"]),
});

type CreateForm = z.infer<typeof createSchema>;

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

const POPULAR_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
  "Pacific/Auckland",
];

interface Campaign {
  _id: string;
  instantlyCampaignId: string;
  name: string;
  prompt: string;
  stepCount: number;
  timezone?: string;
  scheduleName?: string;
  timingFrom?: string;
  timingTo?: string;
  days?: number[];
  delayBetweenSteps?: number;
  delayUnit?: string;
  prospectCount?: number;
  generatedCount?: number;
  repliedCount?: number;
  isActive?: boolean;
  status?: string;
  createdAt: string;
}

export default function Campaigns() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: fetchCampaigns,
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => createCampaign(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setShowCreate(false);
      setShowAdvanced(false);
      reset();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      prompt: "",
      stepCount: "3",
      timezone: "Asia/Kolkata",
      scheduleName: "Business Hours",
      timingFrom: "09:00",
      timingTo: "17:00",
      days: [1, 2, 3, 4, 5],
      delayBetweenSteps: "1",
      delayUnit: "days",
    },
  });

  const campaigns: Campaign[] = data?.data || [];
  const selectedDays = watch("days") || [];

  const toggleDay = (day: number) => {
    const current = selectedDays;
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort();
    setValue("days", updated);
  };

  const onSubmit = (d: CreateForm) => {
    createMut.mutate({
      name: d.name,
      prompt: d.prompt,
      stepCount: parseInt(d.stepCount, 10) || 3,
      timezone: d.timezone,
      scheduleName: d.scheduleName,
      timingFrom: d.timingFrom,
      timingTo: d.timingTo,
      days: d.days,
      delayBetweenSteps: parseInt(d.delayBetweenSteps || "1", 10),
      delayUnit: d.delayUnit,
    });
  };

  const handleModalClose = () => {
    setShowCreate(false);
    setShowAdvanced(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-muted-foreground">
            Manage your Instantly.ai email campaigns
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New Campaign
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
          <div className="w-full max-w-xl mx-4 bg-card rounded-xl border shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-1">Create Campaign</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure your email campaign before generating AI content
            </p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* ---------- Basic Info ---------- */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" /> Basic Info
                </h4>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Campaign Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...register("name")}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. Q4 Outreach - SaaS CTOs"
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive mt-1">
                      {String(errors.name.message)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    AI Prompt <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    {...register("prompt")}
                    rows={4}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Write a personalized cold email for a {{role}} at {{company}}..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variables: {"{{name}}"}, {"{{company}}"}, {"{{role}}"}, {"{{notes}}"}, {"{{painPoints}}"}
                  </p>
                  {errors.prompt && (
                    <p className="text-xs text-destructive mt-1">
                      {String(errors.prompt.message)}
                    </p>
                  )}
                </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Email Steps (1-10)
                    </label>
                    <input
                      type="number"
                      {...register("stepCount")}
                      className="w-24 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      min={1}
                      max={10}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      How many emails in the outreach sequence. Each step is a
                      separate email — step 1 is your initial cold email, and
                      each subsequent step is an AI-generated follow-up that
                      builds on the previous one.{" "}
                      <span className="text-primary font-medium">
                        More steps = more chances to connect, but avoid
                        over-messaging.
                      </span>
                    </p>
                    {errors.stepCount && (
                      <p className="text-xs text-destructive mt-1">
                        {String(errors.stepCount.message)}
                      </p>
                    )}
                  </div>
              </div>

              {/* ---------- Advanced Settings ---------- */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full"
                >
                  {showAdvanced ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  Advanced Settings
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-5 border-l-2 border-muted pl-4">
                    {/* Schedule Settings */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" /> Schedule Settings
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Timezone
                          </label>
                          <select
                            {...register("timezone")}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {POPULAR_TIMEZONES.map((tz) => (
                              <option key={tz} value={tz}>
                                {tz}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Schedule Name
                          </label>
                          <input
                            {...register("scheduleName")}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="Business Hours"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Send From
                          </label>
                          <input
                            type="time"
                            {...register("timingFrom")}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Send Until
                          </label>
                          <input
                            type="time"
                            {...register("timingTo")}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Emails will only be sent within this time window
                      </p>

                      <div>
                        <label className="block text-xs font-medium mb-2">
                          Active Days
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                            const isSelected = selectedDays.includes(day);
                            const isWeekend = day === 6 || day === 7;
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(day)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : `hover:bg-muted ${
                                        isWeekend
                                          ? "border-dashed text-muted-foreground"
                                          : ""
                                      }`
                                }`}
                              >
                                {DAY_LABELS[day]}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Click days to toggle. Dashed = weekend.
                        </p>
                      </div>
                    </div>

                    {/* Sending Behavior */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" /> Sending Behavior
                      </h5>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Delay Between Emails
                          </label>
                          <input
                            type="number"
                            {...register("delayBetweenSteps")}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            min={0}
                            placeholder="1"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Delay Unit
                          </label>
                          <select
                            {...register("delayUnit")}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Time to wait before sending the next email in the sequence
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 rounded-md text-sm font-medium border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {createMut.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Campaign"
                  )}
                </button>
              </div>
              {createMut.error && (
                <p className="text-sm text-destructive">
                  {String(createMut.error)}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Megaphone className="h-12 w-12" />
          <p>No campaigns yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <div
              key={c._id}
              className="rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <Link
                    to={`/campaigns/${c.instantlyCampaignId}`}
                    className="font-semibold hover:text-primary truncate block"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">
                    {c.stepCount} steps ·{" "}
                    {c.delayBetweenSteps !== undefined && c.delayBetweenSteps > 0
                      ? `${c.delayBetweenSteps} ${c.delayUnit || "days"} delay`
                      : "Instant"}
                    {" · "}
                    {c.timezone || "Asia/Kolkata"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {(() => {
                  const cs = c.status || (c.isActive ? "active" : "draft");
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
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyle}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${dotStyle}`} />
                      {label}
                    </span>
                  );
                })()}
              </div>
              <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                {c.prospectCount !== undefined && (
                  <span>{c.prospectCount} prospects</span>
                )}
                {c.repliedCount !== undefined && (
                  <span>{c.repliedCount} replied</span>
                )}
              </div>
              <Link
                to={`/campaigns/${c.instantlyCampaignId}`}
                className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View details <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}