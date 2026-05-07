import { env } from "../config/env.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Obtain an OAuth2 access token using client credentials grant.
 */
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const tenantId = env.GRAPH_TENANT_ID;
  const clientId = env.GRAPH_CLIENT_ID;
  const clientSecret = env.GRAPH_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.warn("⚠️ Graph API not configured — email sending disabled");
    return null;
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(url, { method: "POST", body });

  if (!res.ok) {
    const err = await res.text();
    console.error("❌ Graph token error:", err);
    return null;
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  console.log("✅ Graph API access token obtained");
  return cachedToken;
}

/**
 * Send an email via the Microsoft Graph API.
 * @param {string} toEmail
 * @param {string} subject
 * @param {string} bodyText
 */
async function sendGraphEmail(toEmail, subject, bodyText) {
  const token = await getAccessToken();
  if (!token) return;

  const userId = env.GRAPH_USER_ID;
  // If GRAPH_USER_ID is not set, use "me" (delegated permission — won't work with client credentials)
  const sendAs = userId || "";
  const endpoint = sendAs
    ? `${GRAPH_BASE}/users/${sendAs}/sendMail`
    : `${GRAPH_BASE}/me/sendMail`;

  const payload = {
    message: {
      subject,
      body: {
        contentType: "Text",
        content: bodyText,
      },
      toRecipients: [
        {
          emailAddress: { address: toEmail },
        },
      ],
    },
    saveToSentItems: true,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph sendMail failed (${res.status}): ${err}`);
  }

  // 202 Accepted — no body
  console.log(`📤 Email sent to ${toEmail} via Graph API`);
}

function isGraphConfigured() {
  return env.GRAPH_TENANT_ID && env.GRAPH_CLIENT_ID && env.GRAPH_CLIENT_SECRET && env.GRAPH_USER_ID;
}

/**
 * Forward the lead's reply to the owner's email address.
 * @param {Object} prospect - The prospect document (with email, name, company)
 * @param {string} replyText - The reply text from the lead
 */
export async function forwardReplyToOwner(prospect, replyText) {
  if (!isGraphConfigured() || !env.OWNER_EMAIL) {
    console.warn("⚠️ Skipping forward — Graph API or OWNER_EMAIL not configured");
    return;
  }

  const leadInfo = [
    `Name: ${prospect.name || "N/A"}`,
    `Email: ${prospect.email}`,
    `Company: ${prospect.company || "N/A"}`,
    `Role: ${prospect.role || "N/A"}`,
  ].join("\n");

  const body = [
    "You received a reply from a cold email campaign:",
    "",
    "--- Lead Info ---",
    leadInfo,
    "",
    "--- Reply ---",
    replyText,
  ].join("\n");

  try {
    await sendGraphEmail(
      env.OWNER_EMAIL,
      `🔔 Reply from ${prospect.name || prospect.email}`,
      body,
    );
    console.log(`📤 Reply forwarded to owner for: ${prospect.email}`);
  } catch (err) {
    console.error("❌ Failed to forward reply:", err.message);
  }
}

/**
 * Send a static thank-you email back to the lead.
 * @param {Object} prospect - The prospect document (with email, name)
 */
export async function sendThankYouToLead(prospect) {
  if (!isGraphConfigured()) {
    console.warn("⚠️ Skipping thank-you — Graph API not configured");
    return;
  }

  const firstName = prospect.name?.split(" ")[0] || "there";

  const body = [
    `Hi ${firstName},`,
    "",
    "Thanks for your reply! We've received your message and will get back to you shortly.",
    "",
    "Best regards,",
    "The Team",
  ].join("\n");

  try {
    await sendGraphEmail(prospect.email, "Thanks for your reply!", body);
    console.log(`📤 Thank-you sent to: ${prospect.email}`);
  } catch (err) {
    console.error("❌ Failed to send thank-you:", err.message);
  }
}