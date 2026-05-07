import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload as UploadIcon, File, Check, X, Loader2, AlertCircle, Download, ChevronDown, CheckIcon, CheckCircle, ArrowRight } from "lucide-react";
import { uploadProspects, fetchCampaigns, type Campaign } from "../lib/api";

export default function Upload() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownDirty, setDropdownDirty] = useState(false);
  const [modalData, setModalData] = useState<{
    count: number;
    campaignId: string;
    campaignName: string;
  } | null>(null);

  const { data: campaignsData } = useQuery({
    queryKey: ["campaigns"],
    queryFn: fetchCampaigns,
  });
  const campaigns = campaignsData?.data || [];

  const uploadMut = useMutation({
    mutationFn: ({ file, campaignId }: { file: File; campaignId: string }) =>
      uploadProspects(file, campaignId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      const campaign = campaigns.find((c: Campaign) => c.instantlyCampaignId === variables.campaignId);
      setModalData({
        count: data.data.created ?? 0,
        campaignId: variables.campaignId,
        campaignName: campaign?.name || "",
      });
    },
  });

  const dismissModal = (redirect: boolean) => {
    const cid = modalData?.campaignId;
    setModalData(null);
    setFile(null);
    setPreview([]);
    setCampaignId("");
    if (redirect && cid) {
      navigate(`/campaigns/${cid}`);
    }
  };

  const parsePreview = (f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text
        .split("\n")
        .filter(Boolean)
        .map((l) => l.split(",").map((c) => c.trim()));
      setPreview(lines.slice(0, 5)); // first 5 rows
    };
    reader.readAsText(f);
  };

  const handleFile = (f: File | null) => {
    setFile(f);
    setPreview([]);
    if (f && f.name.endsWith(".csv")) {
      parsePreview(f);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Upload Prospects</h2>
        <p className="text-muted-foreground">Upload a CSV file with prospect data</p>
      </div>

      {/* Drop zone */}
      <div
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          file
            ? "border-primary/50 bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files[0] || null);
        }}
      >
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10">
              <File className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={() => handleFile(null)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-muted">
              <UploadIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Drag & drop a CSV file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                <UploadIcon className="h-4 w-4" /> Browse Files
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Campaign selector */}
      {campaigns.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold mb-2 text-sm">Assign to Campaign</h3>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDropdownOpen((prev) => !prev);
                if (!dropdownOpen) setDropdownDirty(true);
              }}
              onBlur={(e) => {
                const container = e.currentTarget.parentElement;
                if (container && !container.contains(e.relatedTarget as Node)) {
                  setDropdownOpen(false);
                }
              }}
              className={`group w-full rounded-md border px-3 py-2 text-sm transition-all cursor-pointer flex items-center justify-between gap-2
                ${campaignId
                  ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                  : dropdownDirty && !dropdownOpen
                    ? "border-destructive bg-destructive/5 text-destructive ring-1 ring-destructive/20"
                    : "border-transparent bg-muted hover:border-primary"
                }
                focus:outline-none focus:ring-2 focus:ring-ring
              `}
            >
              <span className={campaignId ? "" : "text-muted-foreground"}>
                {campaignId
                  ? campaigns.find((c: Campaign) => c.instantlyCampaignId === campaignId)?.name || campaignId
                  : "-- No campaign (optional) --"}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-all duration-200
                  ${dropdownOpen ? "rotate-180 text-primary" : ""}
                  ${campaignId
                    ? "text-primary"
                    : dropdownDirty && !dropdownOpen
                      ? "text-destructive"
                      : dropdownOpen
                        ? ""
                        : "text-muted-foreground"}`}
              />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-muted border rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 max-h-60 overflow-y-auto">
                <button
                  type="button"
                  onBlur={(e) => {
                    const container = e.currentTarget.parentElement?.parentElement;
                    if (container && !container.contains(e.relatedTarget as Node)) {
                      setDropdownOpen(false);
                    }
                  }}
                  onClick={() => { setCampaignId(""); setDropdownOpen(false); setDropdownDirty(true); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-primary/10 flex items-center justify-between gap-2
                    ${!campaignId ? "bg-primary/5 text-primary font-medium" : ""}`}
                >
                  <span>-- No campaign (optional) --</span>
                  {!campaignId && <CheckIcon className="h-4 w-4 shrink-0 text-primary" />}
                </button>
                {campaigns.map((c: Campaign) => (
                  <button
                    key={c.instantlyCampaignId}
                    type="button"
                    onBlur={(e) => {
                      const container = e.currentTarget.parentElement?.parentElement;
                      if (container && !container.contains(e.relatedTarget as Node)) {
                        setDropdownOpen(false);
                      }
                    }}
                    onClick={() => { setCampaignId(c.instantlyCampaignId); setDropdownOpen(false); setDropdownDirty(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-primary/10 flex items-center justify-between gap-2
                      ${campaignId === c.instantlyCampaignId ? "bg-primary/5 text-primary font-medium" : ""}`}
                  >
                    <span>{c.name}</span>
                    {campaignId === c.instantlyCampaignId && <CheckIcon className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            All uploaded prospects will be linked to the selected campaign.
          </p>
        </div>
      )}

      {/* CSV Format info */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Expected CSV Format</h3>
          <button
            onClick={() => {
              const headers = "email,name,company,role,painPoints,notes\n";
              const blob = new Blob([headers], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "prospects_template.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Download className="h-3 w-3" /> Download Template
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Columns: <code className="bg-muted px-1 rounded">email</code> (required),{" "}
          <code className="bg-muted px-1 rounded">name</code>,{" "}
          <code className="bg-muted px-1 rounded">company</code>,{" "}
          <code className="bg-muted px-1 rounded">role</code>,{" "}
          <code className="bg-muted px-1 rounded">painPoints</code>,{" "}
          <code className="bg-muted px-1 rounded">notes</code>
        </p>
        <p className="text-xs text-muted-foreground">
          Campaign assignment is handled via the dropdown selector above — do not include a campaign column in the file.
        </p>
        {file && !file.name.endsWith(".csv") && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Only CSV files are supported
          </p>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h3 className="font-semibold text-sm">Preview (first 5 rows)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  {preview[0].map((h, i) => (
                    <th key={i} className="text-left px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.slice(1).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload button */}
      {file && (
        <button
          onClick={() => uploadMut.mutate({ file, campaignId })}
          disabled={uploadMut.isPending || !file.name.endsWith(".csv")}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {uploadMut.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> Upload Prospects
            </>
          )}
        </button>
      )}

      {uploadMut.error && (
        <div className="rounded-xl border bg-destructive/10 border-destructive/30 p-4">
          <p className="text-sm text-destructive">{(uploadMut.error as Error).message}</p>
        </div>
      )}

      {/* Success Modal */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => dismissModal(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl bg-card border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/50 w-fit">
                <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>

              <h3 className="text-xl font-bold mb-2">Upload Successful!</h3>
              <p className="text-muted-foreground mb-1">
                {modalData.count} prospect{modalData.count !== 1 ? "s" : ""} imported
              </p>
              {modalData.campaignName && (
                <p className="text-sm text-muted-foreground mb-4">
                  Assigned to <span className="font-medium text-foreground">{modalData.campaignName}</span>
                </p>
              )}

              <div className="flex flex-col gap-2 mt-6">
                {modalData.campaignId && (
                  <button
                    onClick={() => dismissModal(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Go to Campaign
                  </button>
                )}
                <button
                  onClick={() => dismissModal(false)}
                  className="px-4 py-2.5 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80 transition-colors"
                >
                  Stay Here
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}