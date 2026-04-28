import { env } from "../config/env.js";

const INSTANTLY_BASE = "https://api.instantly.ai/api/v2";

// Track which campaigns have already been configured (per process)
const configuredCampaigns = new Set();

/**
 * Build the expected email template steps for a campaign.
 * Dynamic — supports any number of steps.
 */
function buildExpectedSteps(stepCount) {
  const steps = [];
  for (let i = 1; i <= stepCount; i++) {
    steps.push({
      subject: `{{step${i}_subject}}`,
      body: `{{step${i}_body}}`,
    });
  }
  return steps;
}

/**
 * Auto-configure a campaign's email sequence to use payload variables,
 * so subject/body from each lead automatically populate the emails.
 * Only runs once per campaign per process (idempotent).
 */
async function ensureCampaignSteps(
  campaignId,
  stepCount = 3,
  delayBetweenSteps = 1,
  delayUnit = "days"
) {
  if (configuredCampaigns.has(campaignId)) return;
  configuredCampaigns.add(campaignId);

  const headers = {
    Authorization: `Bearer ${env.INSTANTLY_API_KEY}`,
    "Content-Type": "application/json",
  };

  // 1. Fetch current campaign to check if steps need updating
  const getRes = await fetch(`${INSTANTLY_BASE}/campaigns/${campaignId}`, { headers });
  if (!getRes.ok) {
    console.warn(`⚠️ Could not fetch campaign ${campaignId}, skipping template setup`);
    return;
  }
  const camp = await getRes.json();
  const steps = camp?.sequences?.[0]?.steps;

  // Build expected templates
  const expected = buildExpectedSteps(stepCount);

  // Check if all steps already match
  let needsUpdate = !steps || steps.length !== stepCount;
  if (!needsUpdate) {
    for (let i = 0; i < stepCount; i++) {
      const v = steps[i]?.variants?.[0];
      if (!v || v.subject !== expected[i].subject || v.body !== expected[i].body) {
        needsUpdate = true;
        break;
      }
    }
  }

  if (!needsUpdate) {
    console.log(`✅ Campaign ${campaignId} templates already correct (${stepCount} steps)`);
    return;
  }

  // 2. Patch campaign with correct steps
  console.log(`🔧 Auto-configuring campaign ${campaignId} with ${stepCount} steps...`);
  const patch = {
    sequences: [
      {
        steps: expected.map((e) => ({
          type: "email",
          delay: delayBetweenSteps,
          delay_unit: delayUnit,
          variants: [e],
        })),
      },
    ],
  };

  const patchRes = await fetch(`${INSTANTLY_BASE}/campaigns/${campaignId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
  });

  if (patchRes.ok) {
    console.log(`✅ Campaign ${campaignId} templates configured`);
  } else {
    const errBody = await patchRes.text();
    console.warn(`⚠️ Campaign ${campaignId} template setup failed:`, patchRes.status, errBody);
  }
}

/**
 * Fetch a campaign from Instantly and return the number of steps in its sequence.
 * Used to auto-derive stepCount so CSV/users don't need to specify it.
 */
export async function getCampaignStepCount(campaignId) {
  const headers = {
    Authorization: `Bearer ${env.INSTANTLY_API_KEY}`,
  };

  const res = await fetch(`${INSTANTLY_BASE}/campaigns/${campaignId}`, { headers });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`getCampaignStepCount error (${res.status}): ${errBody}`);
  }

  const camp = await res.json();
  const steps = camp?.sequences?.[0]?.steps || [];
  return steps.length;
}

/**
 * Create a new campaign in Instantly.
 */
export async function createCampaign({
  name,
  stepCount = 3,
  timezone = "Asia/Kolkata",
  scheduleName = "Business Hours",
  timingFrom = "09:00",
  timingTo = "17:00",
  days = [1, 2, 3, 4, 5],
  delayBetweenSteps = 1,
  delayUnit = "days",
}) {
  if (!env.INSTANTLY_API_KEY) {
    throw new Error("INSTANTLY_API_KEY is not configured");
  }

  const headers = {
    Authorization: `Bearer ${env.INSTANTLY_API_KEY}`,
    "Content-Type": "application/json",
  };

  // Create the campaign (v2 requires campaign_schedule)
  const createRes = await fetch(`${INSTANTLY_BASE}/campaigns`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      campaign_schedule: {
        schedules: [
          {
            name: scheduleName,
            timezone,
            timing: {
              from: timingFrom,
              to: timingTo,
            },
            days: days.reduce((acc, d) => ({ ...acc, [d]: true }), {}),
          },
        ],
      },
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    throw new Error(`Instantly create campaign error (${createRes.status}): ${errBody}`);
  }

  const campaign = await createRes.json();
  const campaignId = campaign.id || campaign._id;

  if (!campaignId) {
    throw new Error("Instantly did not return a campaign ID");
  }

  // Auto-configure sequence templates
  await ensureCampaignSteps(campaignId, stepCount, delayBetweenSteps, delayUnit);

  return { id: campaignId, name, stepCount };
}

/**
 * Add a single lead to an Instantly campaign.
 * Step count is derived dynamically from the campaign itself — no stepCount param needed.
 * Auto-configures campaign email templates on first call per campaign.
 * https://developer.instantly.ai/guides/api-v1-migration
 */
export async function addLeadToCampaign({
  email,
  first_name,
  company,
  campaignId = null,
  customVariables = {},
}) {
  if (!env.INSTANTLY_API_KEY) {
    throw new Error("INSTANTLY_API_KEY is not configured");
  }

  // Fall back to default campaign from env if none provided
  const resolvedCampaignId =
    campaignId || env.INSTANTLY_CAMPAIGN_ID || env.INSTANTLY_DEFAULT_CAMPAIGN_ID;
  if (!resolvedCampaignId) {
    throw new Error("No campaignId provided and INSTANTLY_CAMPAIGN_ID is not configured");
  }

  // Derive stepCount from the campaign (NOT from CSV/prospect)
  const stepCount = await getCampaignStepCount(resolvedCampaignId);

  // Auto-configure campaign steps once per process per campaign
  await ensureCampaignSteps(resolvedCampaignId, stepCount);

  const body = {
    email,
    first_name,
    campaign: resolvedCampaignId,
    ...(company && { company_name: company }),
    custom_variables: customVariables,
  };

  const res = await fetch(`${INSTANTLY_BASE}/leads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.INSTANTLY_API_KEY}`,
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