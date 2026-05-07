import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Clock, Send, MessageSquare, X } from "lucide-react";
import { fetchProspect } from "../lib/api";

/** Extract & sort step keys from sequence map (step1, step2, ...) */
function getSortedStepKeys(
  seq: Record<string, { subject: string; body: string; sent: boolean }> | undefined
): string[] {
  if (!seq) return [];
  return Object.keys(seq)
    .filter((k) => /^step\d+$/.test(k))
    .sort((a, b) => {
      const na = parseInt(a.replace("step", ""), 10);
      const nb = parseInt(b.replace("step", ""), 10);
      return na - nb;
    });
}

interface EmailStep {
  key: string;
  stepNumber: number;
  subject: string;
  body: string;
  sent: boolean;
  isCurrentStep: boolean;
}

export default function ProspectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedStep, setSelectedStep] = useState<EmailStep | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["prospect", id],
    queryFn: () => fetchProspect(id!),
    enabled: !!id,
  });

  const prospect = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !prospect) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-destructive font-medium">Failed to load prospect</p>
        <button onClick={() => navigate(-1)} className="text-sm text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const seq = prospect.sequence || {};

  return (
    <div className="space-y-6 max-w-3xl">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">{prospect.name || prospect.email}</h2>
        <p className="text-muted-foreground mt-1">{prospect.email}</p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {prospect.company && (
          <div className="rounded-xl border bg-card p-3">
            <p className="text-xs text-muted-foreground">Company</p>
            <p className="text-sm font-medium mt-0.5">{prospect.company}</p>
          </div>
        )}
        {prospect.role && (
          <div className="rounded-xl border bg-card p-3">
            <p className="text-xs text-muted-foreground">Role</p>
            <p className="text-sm font-medium mt-0.5">{prospect.role}</p>
          </div>
        )}
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm font-medium mt-0.5 capitalize">{prospect.status.replace(/_/g, " ")}</p>
        </div>
        {prospect.campaignId && (
          <Link
            to={`/campaigns/${prospect.campaignId}`}
            className="rounded-xl border bg-card p-3 block hover:bg-muted/50 hover:border-primary/50 transition-colors"
          >
            <p className="text-xs text-muted-foreground">Campaign</p>
            <p className="text-sm font-medium mt-0.5 text-primary hover:underline">
              {prospect.campaignName || prospect.campaignId}
            </p>
          </Link>
        )}
      </div>

      {/* Pain points */}
      {prospect.painPoints && prospect.painPoints.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold mb-2">Pain Points</h3>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {prospect.painPoints.map((pp: string, i: number) => (
              <li key={i}>{pp}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {prospect.notes && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold mb-2">Notes</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{prospect.notes}</p>
        </div>
      )}

      {/* Email sequence */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Email Sequence</h3>
          {(() => {
            const stepKeys = getSortedStepKeys(prospect.sequence);
            const sentCount = stepKeys.filter((k) => prospect.sequence?.[k]?.sent).length;
            const totalSteps = stepKeys.length;
            if (totalSteps > 0) {
              const pct = Math.round((sentCount / totalSteps) * 100);
              return (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    {sentCount}/{totalSteps}
                  </span>
                </div>
              );
            }
            return null;
          })()}
        </div>
        {(() => {
          const stepKeys = getSortedStepKeys(prospect.sequence);
          if (stepKeys.length === 0) {
            return <p className="text-sm text-muted-foreground">No emails generated yet</p>;
          }
          return (
            <div className="space-y-3">
              {stepKeys.map((key, index) => {
                const email = seq[key];
                const stepNumber = parseInt(key.replace("step", ""), 10);
                // currentStep is 0-based in the UI, matches 0=index of first step
                const isCurrentStep = prospect.currentStep === index && !email.sent;
                return (
                  <div
                    key={key}
                    className={`rounded-lg border p-3 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all ${
                      email.sent
                        ? "bg-muted/30 border-muted"
                        : isCurrentStep
                        ? "border-primary/50 bg-primary/5"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedStep({
                        key,
                        stepNumber,
                        subject: email.subject,
                        body: email.body,
                        sent: email.sent,
                        isCurrentStep,
                      })
                    }
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">
                        Step {stepNumber}
                        {isCurrentStep && (
                          <span className="ml-2 text-primary">· Sending</span>
                        )}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          email.sent
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                        }`}
                      >
                        {email.sent ? (
                          <>
                            <Send className="h-3 w-3" /> Sent
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" /> Pending
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1 truncate">{email.subject}</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
                      {email.body}
                    </p>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Reply */}
      {prospect.reply_text && (
        <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 p-4">
          <h3 className="font-semibold flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-300">
            <MessageSquare className="h-4 w-4" /> Reply Received
            {prospect.repliedToStep != null && prospect.repliedToStep > 0 && (
              <span className="text-xs font-normal bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full">
                Replied to Step {prospect.repliedToStep}
              </span>
            )}
          </h3>
          <p className="text-sm whitespace-pre-wrap">{prospect.reply_text}</p>
          {prospect.repliedAt && (
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(prospect.repliedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Email Detail Modal */}
      {selectedStep && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedStep(null)}
        >
          <div
            className="bg-card rounded-xl border shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Step {selectedStep.stepNumber}
                  {selectedStep.isCurrentStep && (
                    <span className="ml-2 text-primary">· Sending</span>
                  )}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                    selectedStep.sent
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                  }`}
                >
                  {selectedStep.sent ? (
                    <>
                      <Send className="h-3 w-3" /> Sent
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" /> Pending
                    </>
                  )}
                </span>
              </div>
              <button
                onClick={() => setSelectedStep(null)}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body — scrollable */}
            <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Subject
                </h4>
                <p className="text-base font-semibold">{selectedStep.subject}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Body
                </h4>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {selectedStep.body}
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-3 border-t text-right">
              <button
                onClick={() => setSelectedStep(null)}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}