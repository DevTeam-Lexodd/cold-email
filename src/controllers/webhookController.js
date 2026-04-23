import { z } from "zod";
import { Prospect } from "../models/Prospect.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/errors.js";
import { classifyReply, scoreProspect } from "../services/leadScoringService.js";

const ReplyWebhookSchema = z.object({
  email: z.string().trim().email(),
  reply: z.string().trim().min(1)
});

export const handleReplyWebhook = asyncHandler(async (req, res) => {
  const { email, reply } = ReplyWebhookSchema.parse(req.body || {});

  const prospect = await Prospect.findOne({ email }).exec();
  if (!prospect) throw new HttpError(404, "Prospect not found");

  const replyType = classifyReply(reply);
  prospect.status = "replied";
  prospect.reply_text = reply;
  prospect.reply_type = replyType;
  prospect.score = scoreProspect({
    company: prospect.company,
    role: prospect.role,
    painPoints: prospect.painPoints,
    notes: prospect.notes,
    replyType
  });

  await prospect.save();
  res.json({ ok: true });
});

