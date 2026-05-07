import { z } from "zod";
import { Prospect } from "../models/Prospect.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/errors.js";
import { forwardReplyToOwner, sendThankYouToLead } from "../services/emailService.js";

const EmailSentWebhookSchema = z.object({
  email: z.string().trim().email().optional(),
  lead_email: z.string().trim().email().optional(),
  campaign_id: z.string().trim().optional(),
  lead_id: z.string().trim().optional(),
  event: z.string().trim().optional(), // "email_sent"
  timestamp: z.string().trim().optional(),
}).refine(
  (data) => data.email || data.lead_email,
  { message: "Either email or lead_email is required" }
);

export const handleEmailSentWebhook = asyncHandler(async (req, res) => {
  console.log("📨 Email Sent webhook received:", JSON.stringify(req.body));

  // Try to parse with schema, but also accept raw body
  const parsed = EmailSentWebhookSchema.safeParse(req.body || {});
  
  let email, lead_id, campaign_id;
  if (parsed.success) {
    email = parsed.data.email || parsed.data.lead_email;
    lead_id = parsed.data.lead_id;
    campaign_id = parsed.data.campaign_id;
  } else {
    // Be lenient: try to extract email/lead_id from any shape
    const b = req.body || {};
    email = b.email || b.lead_email || b.recipient || "";
    lead_id = b.lead_id || b.leadId || b.id || "";
    campaign_id = b.campaign_id || b.campaignId || "";
    console.log("⚠️ Email sent webhook: using lenient parsing, email=", email, "lead_id=", lead_id, "campaign_id=", campaign_id);
  }

  if (!email || (!email.includes("@"))) {
    console.log("⚠️ Email sent webhook: no valid email found, ignoring");
    return res.json({ ok: true, ignored: true, reason: "no valid email" });
  }

  // Look up by instantlyLeadId first, fall back to email
  let prospect = null;
  if (lead_id) {
    prospect = await Prospect.findOne({ instantlyLeadId: lead_id }).exec();
  }
  if (!prospect) {
    // Tie-break duplicate emails across campaigns using campaign_id (always present per Instantly v2 schema)
    const emailQuery = { email: email.toLowerCase().trim() };
    if (campaign_id) emailQuery.campaignId = campaign_id;
    prospect = await Prospect.findOne(emailQuery).exec();
  }
  if (!prospect) {
    console.warn(`⚠️ Email sent webhook: prospect not found for ${email}`);
    return res.json({ ok: false, reason: "prospect not found" });
  }

  // Only block if already replied (terminal state). "sent" only means step 1 went out;
  // we still need to process webhooks for steps 2, 3, etc.
  if (prospect.status !== "replied") {
    // Mark the current step as sent and advance currentStep
    const stepIndex = prospect.currentStep || 0;
    const stepKey = `step${stepIndex + 1}`;
    const stepData = prospect.sequence?.get(stepKey);
    if (stepData) {
      prospect.sequence.set(stepKey, {
        subject: stepData.subject,
        body: stepData.body,
        sent: true,
      });
    }
    prospect.currentStep = stepIndex + 1;

    // Update overall status to "sent" (replied is handled by reply webhook)
    prospect.status = "sent";
    await prospect.save();
    console.log(`✅ Marked ${email} as sent (via webhook), step ${stepKey} sent, currentStep → ${prospect.currentStep}`);
  }

  res.json({ ok: true });
});

const ReplyWebhookSchema = z.object({
  // v2: Instantly sends "reply_text"
  // v1: older integrations sent "reply"
  // Accept both for backward compatibility
  email: z.string().trim().email().optional(),
  lead_email: z.string().trim().email().optional(),
  reply_text: z.string().trim().optional(),
  reply: z.string().trim().optional(),
  campaign_id: z.string().trim().optional(),
  lead_id: z.string().trim().optional(),
  timestamp: z.string().trim().optional(),
}).refine(
  (data) => data.email || data.lead_email,
  { message: "Either email or lead_email is required" }
).refine(
  (data) => data.reply_text || data.reply,
  { message: "Either reply_text or reply is required" }
);

export const handleReplyWebhook = asyncHandler(async (req, res) => {
  const { email, lead_email, reply_text, reply, campaign_id, lead_id } = ReplyWebhookSchema.parse(req.body || {});
  const resolvedEmail = email || lead_email;
  const replyContent = reply_text || reply;

  // Look up by instantlyLeadId first (more precise), fall back to email
  let prospect = null;
  if (lead_id) {
    prospect = await Prospect.findOne({ instantlyLeadId: lead_id }).exec();
  }
  if (!prospect) {
    // Tie-break duplicate emails across campaigns using campaign_id (always present per Instantly v2 schema)
    const emailQuery = { email: resolvedEmail };
    if (campaign_id) emailQuery.campaignId = campaign_id;
    prospect = await Prospect.findOne(emailQuery).exec();
  }
  if (!prospect) throw new HttpError(404, "Prospect not found");

  // Mark the current step as sent (reply confirms delivery)
  const stepIndex = prospect.currentStep || 0;
  if (stepIndex > 0) {
    // The previous step was sent
    const prevStepKey = `step${stepIndex}`;
    const prevStepData = prospect.sequence?.get(prevStepKey);
    if (prevStepData) {
      prospect.sequence.set(prevStepKey, {
        subject: prevStepData.subject,
        body: prevStepData.body,
        sent: true,
      });
    }
  }

  // Save the reply
  prospect.status = "replied";
  prospect.reply_text = replyContent;
  prospect.repliedAt = new Date();
  prospect.repliedToStep = stepIndex; // which step triggered the reply
  prospect.forwardedToSales = true;

  await prospect.save();

  // Forward the reply to the owner and send a thank-you to the lead (fire-and-forget)
  forwardReplyToOwner(prospect, replyContent).catch((err) =>
    console.error("❌ Forward to owner failed:", err.message)
  );
  sendThankYouToLead(prospect).catch((err) =>
    console.error("❌ Thank-you to lead failed:", err.message)
  );

  res.json({ ok: true });
});

