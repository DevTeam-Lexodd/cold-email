import { z } from "zod";
import { Prospect } from "../models/Prospect.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/errors.js";
import { forwardReplyToOwner, sendThankYouToLead } from "../services/emailService.js";

const ReplyWebhookSchema = z.object({
  // v2: Instantly sends "reply_text"
  // v1: older integrations sent "reply"
  // Accept both for backward compatibility
  email: z.string().trim().email(),
  reply_text: z.string().trim().optional(),
  reply: z.string().trim().optional(),
  campaign_id: z.string().trim().optional(),
  lead_id: z.string().trim().optional(),
  timestamp: z.string().trim().optional(),
}).refine(
  (data) => data.reply_text || data.reply,
  { message: "Either reply_text or reply is required" }
);

export const handleReplyWebhook = asyncHandler(async (req, res) => {
  const { email, reply_text, reply, campaign_id, lead_id } = ReplyWebhookSchema.parse(req.body || {});
  const replyContent = reply_text || reply;

  // Look up by instantlyLeadId first (more precise), fall back to email
  let prospect = null;
  if (lead_id) {
    prospect = await Prospect.findOne({ instantlyLeadId: lead_id }).exec();
  }
  if (!prospect) {
    prospect = await Prospect.findOne({ email }).exec();
  }
  if (!prospect) throw new HttpError(404, "Prospect not found");

  // Save the reply
  prospect.status = "replied";
  prospect.reply_text = replyContent;
  prospect.repliedAt = new Date();
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

