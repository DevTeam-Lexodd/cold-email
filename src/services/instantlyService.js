import { env } from "../config/env.js";

const INSTANTLY_BASE = "https://api.instantly.ai/api/v2";

/**
 * Add a single lead to an Instantly campaign.
 * https://developer.instantly.ai/guides/api-v1-migration
 */
export async function addLeadToCampaign({
  email,
  first_name,
  company,
  payload = {}
}) {
  if (!env.INSTANTLY_API_KEY) {
    throw new Error("INSTANTLY_API_KEY is not configured");
  }
  if (!env.INSTANTLY_CAMPAIGN_ID) {
    throw new Error("INSTANTLY_CAMPAIGN_ID is not configured");
  }

  const body = {
    campaign_id: env.INSTANTLY_CAMPAIGN_ID,
    email,
    first_name,
    ...(company && { company_name: company }),
    payload,
  };

  const res = await fetch(`${INSTANTLY_BASE}/leads`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.INSTANTLY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Instantly API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data; // contains the created lead, including its id
}

/**
 * Bulk add up to 1000 leads.
 * Each lead follows the same shape as addLeadToCampaign,
 * minus the campaign_id (set once at the top level).
 */
export async function bulkAddLeads({ leads = [] }) {
  if (!env.INSTANTLY_API_KEY) {
    throw new Error("INSTANTLY_API_KEY is not configured");
  }
  if (!env.INSTANTLY_CAMPAIGN_ID) {
    throw new Error("INSTANTLY_CAMPAIGN_ID is not configured");
  }
  if (!leads.length) {
    return { added: 0 };
  }

  const body = {
    campaign_id: env.INSTANTLY_CAMPAIGN_ID,
    leads: leads.map((l) => ({
      email: l.email,
      first_name: l.first_name,
      ...(l.company && { company_name: l.company }),
      payload: l.payload || {},
    })),
  };

  const res = await fetch(`${INSTANTLY_BASE}/leads/add`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.INSTANTLY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Instantly bulk API error (${res.status}): ${errBody}`);
  }

  return res.json();
}