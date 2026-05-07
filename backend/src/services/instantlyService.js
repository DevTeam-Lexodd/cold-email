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
 * Activate a campaign so it starts sending emails automatically.
 * Campaigns in Instantly are created in "draft" status and must be activated.
 */
async function activateCampaign(campaignId) {
  const headers = {
    Authorization: `Bearer ${env.INSTANTLY_API_KEY}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(`${INSTANTLY_BASE}/campaigns/${campaignId}/activate`, {
    method: "POST",
    headers,
    body: "{}",
  });

  if (res.ok) {
    console.log(`✅ Campaign ${campaignId} activated`);
    return true;
  } else {
    const errBody = await res.text();
    const msg = `Campaign ${campaignId} activation failed (${res.status}): ${errBody}`;
    console.error(`❌ ${msg}`);
    throw new Error(msg);
  }
}

/**
 * Fetch a campaign's live status from Instantly.
 * Returns { isActive, status } where status is "active", "paused", or "draft".
 */
export async function getCampaignLiveStatus(campaignId) {
  const headers = {
    Authorization: `Bearer ${env.INSTANTLY_API_KEY}`,
  };

  const res = await fetch(`${INSTANTLY_BASE}/campaigns/${campaignId}`, { headers });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`getCampaignLiveStatus error (${res.status}): ${errBody}`);
  }

  const camp = await res.json();
  // Instantly API may return status in various shapes — log to debug
  console.log(`📡 Instantly raw campaign ${campaignId}:`, JSON.stringify({ 
    id: camp?.id, 
    status: camp?.status, 
    campaign_status: camp?.campaign_status,
    is_active: camp?.is_active,
    active: camp?.active,
    keys: Object.keys(camp || {}).filter(k => k.toLowerCase().includes('status') || k.toLowerCase().includes('active'))
  }));

  // Try multiple possible fields
  const rawStatus = String(
    camp?.status ?? 
    camp?.campaign_status ?? 
    (camp?.is_active === true ? "active" : undefined) ??
    (camp?.active === true ? "active" : undefined) ??
    "draft"
  ).toLowerCase().trim();

  // Normalize: common Instantly status values
  const activeLike = ["active", "running", "live", "enabled", "1", "true"];
  const pausedLike = ["paused", "stopped", "disabled", "0", "false"];
  let normalizedStatus;
  if (activeLike.includes(rawStatus)) {
    normalizedStatus = "active";
  } else if (pausedLike.includes(rawStatus)) {
    normalizedStatus = "paused";
  } else {
    normalizedStatus = "draft";
  }

  console.log(`📡 Campaign ${campaignId} normalized status: ${normalizedStatus} (raw: "${rawStatus}")`);
  return { isActive: normalizedStatus === "active", status: normalizedStatus };
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
 * Verify that sales@lexodd.in exists in the Instantly account list
 * and warn if the OAuth token has expired (so the user can re-authenticate).
 */
async function verifyEmailAccount() {
  const headers = { Authorization: `Bearer ${env.INSTANTLY_API_KEY}` };
  const res = await fetch(`${INSTANTLY_BASE}/accounts`, { headers });
  if (!res.ok) {
    console.warn(`⚠️ Could not verify email accounts: ${res.status}`);
    return;
  }

  const data = await res.json();
  const accounts = Array.isArray(data?.items) ? data.items : [];

  const target = accounts.find(
    (a) => (a.email || "").toLowerCase() === "sales@lexodd.in"
  );

  if (target) {
    // Ensure correct display names on the sender account
    const desiredFirstName = "Lexodd";
    const desiredAccountName = "Lexodd Hypernova Private Limited";
    const currentFirstName = target.first_name || "";
    const currentAccountName = target.name || target.account_name || "";

    if (currentFirstName !== desiredFirstName || currentAccountName !== desiredAccountName) {
      console.log(
        `🔧 Updating sender account display: "${currentFirstName}" → "${desiredFirstName}", ` +
        `"${currentAccountName}" → "${desiredAccountName}"`
      );
      try {
        const patchRes = await fetch(
          `${INSTANTLY_BASE}/accounts/${target.email}`,
          {
            method: "PATCH",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              first_name: desiredFirstName,
              name: desiredAccountName,
            }),
          }
        );
        if (patchRes.ok) {
          console.log("✅ Sender account display names updated");
        } else {
          const errText = await patchRes.text();
          console.warn(`⚠️ Failed to update sender account display: ${patchRes.status} ${errText.substring(0, 200)}`);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to update sender account display: ${err.message}`);
      }
    }

    const statusMsg = target.status_message?.e_message || "";
    if (statusMsg.toLowerCase().includes("oauth") || statusMsg.toLowerCase().includes("expired")) {
      console.warn(
        `⚠️ sales@lexodd.in OAuth token expired — re-authenticate in Instantly to enable sending.\n` +
        `   Error: ${statusMsg.substring(0, 120)}...`
      );
    } else {
      console.log(`📧 sales@lexodd.in account found and active`);
    }
  } else {
    console.warn(`⚠️ sales@lexodd.in not found in email accounts`);
  }
}

/**
 * Create a new campaign in Instantly and activate it.
 * Automatically assigns the sales@lexodd.in email account via email_list.
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

  // Verify the email account exists (will log OAuth warnings if needed)
  await verifyEmailAccount();

  // Build sequences upfront so the campaign is created with steps already configured
  const expected = buildExpectedSteps(stepCount);
  const sequences = [
    {
      steps: expected.map((e) => ({
        type: "email",
        delay: delayBetweenSteps,
        delay_unit: delayUnit,
        variants: [e],
      })),
    },
  ];

  // Build payload — email_list is the field Instantly uses to assign email accounts
  const payload = {
    name,
    sequences,
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
    email_list: ["sales@lexodd.in"],
  };

  // Create the campaign
  const createRes = await fetch(`${INSTANTLY_BASE}/campaigns`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
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

  // Mark as configured so ensureCampaignSteps skips if called later
  configuredCampaigns.add(campaignId);
  console.log(`✅ Campaign ${campaignId} created with ${stepCount} steps`);

  // Small delay to let Instantly process the new campaign before activating
  await new Promise((r) => setTimeout(r, 3000));

  // Try to activate with retries
  let activated = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await activateCampaign(campaignId);
      activated = true;
      break;
    } catch (err) {
      console.warn(`⚠️ Activation attempt ${attempt}/3 failed for ${campaignId}: ${err.message}`);
      if (attempt < 3) {
        // Wait longer between retries
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  if (!activated) {
    console.warn(
      `⚠️ Campaign ${campaignId} created but could NOT be auto-activated. ` +
        `It is in DRAFT status. Activate it manually in Instantly or click "Resume".`
    );
  }

  return { id: campaignId, name, stepCount, activated };
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

/**
 * Delete a campaign from Instantly.
 */
export async function deleteCampaign(campaignId) {
  if (!env.INSTANTLY_API_KEY) {
    throw new Error("INSTANTLY_API_KEY is not configured");
  }

  const headers = {
    Authorization: `Bearer ${env.INSTANTLY_API_KEY}`,
  };

  const res = await fetch(`${INSTANTLY_BASE}/campaigns/${campaignId}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Instantly delete campaign error (${res.status}): ${errBody}`);
  }

  return true;
}