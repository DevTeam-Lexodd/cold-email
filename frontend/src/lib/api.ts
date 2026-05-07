const BASE = "/api";

function getToken(): string | null {
  try {
    return localStorage.getItem("coldmail_token");
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  localStorage.setItem("coldmail_token", token);
}

export function clearToken() {
  localStorage.removeItem("coldmail_token");
  localStorage.removeItem("coldmail_user");
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${url}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(body.error?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export interface StatsOverview {
  totalProspects: number;
  totalCampaigns: number;
  pending?: number;
  generated?: number;
  replied?: number;
  generatedCount?: number;
  pushedCount?: number;
  sentCount?: number;
  perCampaign: { campaignId: string; campaignName: string; count: number }[];
  recentActivity: {
    _id: string;
    name?: string;
    email: string;
    company?: string;
    status: string;
    campaignId?: string;
    campaignName?: string;
    updatedAt: string;
  }[];
}

export interface Campaign {
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
  delayUnit?: "minutes" | "hours" | "days";
  prospectCount?: number;
  generatedCount?: number;
  sentCount?: number;
  repliedCount?: number;
  isActive?: boolean;
  status?: string;
  stats?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface Prospect {
  _id: string;
  name?: string;
  email: string;
  company?: string;
  role?: string;
  painPoints?: string[];
  notes?: string;
  status: string;
  campaignId?: string;
  campaignName?: string;
  sequence?: Record<string, { subject: string; body: string; sent: boolean }>;
  currentStep: number;
  forwardedToSales?: boolean;
  instantlyLeadId?: string;
  repliedAt?: string;
  reply_text?: string;
  repliedToStep?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// Stats
export const fetchStats = () => request<{ data: StatsOverview }>("/prospects/stats/overview");

// Campaigns
export const fetchCampaigns = () => request<{ data: Campaign[] }>("/campaigns");
export const fetchCampaign = (id: string) => request<{ data: Campaign }>(`/campaigns/${id}`);
export const createCampaign = (body: Record<string, unknown>) =>
  request<{ data: Campaign }>("/campaigns", { method: "POST", body: JSON.stringify(body) });
export const updateCampaign = (id: string, body: Record<string, unknown>) =>
  request<{ data: Campaign }>(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) });
// Auth
export interface AuthUser {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResponse {
  data: { user: AuthUser; token: string };
}

export const loginRequest = (email: string, password: string) =>
  request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const registerRequest = (email: string, password: string, name?: string) =>
  request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });

export const fetchMe = () => request<{ data: { user: AuthUser } }>("/auth/me");

// Prospects
export const fetchProspects = (params?: Record<string, string>) => {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<PaginatedResponse<Prospect>>(`/prospects${q}`);
};
export const fetchProspect = (id: string) => request<{ data: Prospect }>(`/prospects/${id}`);
export const createProspect = (body: Record<string, unknown>) =>
  request<{ data: Prospect }>("/prospects", { method: "POST", body: JSON.stringify(body) });
export const updateProspect = (id: string, body: Record<string, unknown>) =>
  request<{ data: Prospect }>(`/prospects/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const uploadProspects = (file: File, campaignId?: string) => {
  const fd = new FormData();
  fd.append("file", file);
  if (campaignId) fd.append("campaignId", campaignId);
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${BASE}/prospects/upload`, { method: "POST", body: fd, headers }).then((r) => {
    if (r.status === 401) {
      clearToken();
      window.location.href = "/login";
      throw new Error("Session expired");
    }
    return r.json();
  });
};
