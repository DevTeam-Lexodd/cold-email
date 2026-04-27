import { z } from "zod";
import { Prospect } from "../models/Prospect.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/errors.js";
import { forwardReplyToOwner, sendThankYouToLead } from "../services/emailService.js";

const ReplyWebhookSchema = z.object({
  email: z.string().trim().email(),
  reply: z.string().trim().min(1)
});

export const handleReplyWebhook = asyncHandler(async (req, res) => {
  const { email, reply } = ReplyWebhookSchema.parse(req.body || {});

  const prospect = await Prospect.findOne({ email }).exec();
  if (!prospect) throw new HttpError(404, "Prospect not found");

  // Save the reply
  prospect.status = "replied";
  prospect.reply_text = reply;
  prospect.repliedAt = new Date();
  prospect.forwardedToSales = true;

  await prospect.save();

  // Forward the reply to the owner and send a thank-you to the lead (fire-and-forget)
  forwardReplyToOwner(prospect, reply).catch((err) =>
    console.error("❌ Forward to owner failed:", err.message)
  );
  sendThankYouToLead(prospect).catch((err) =>
    console.error("❌ Thank-you to lead failed:", err.message)
  );

  res.json({ ok: true });
});

