import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/errors.js";
import { createCampaign } from "../services/instantlyService.js";
import { Campaign } from "../models/Campaign.js";

const CreateCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  stepCount: z.coerce.number().int().min(1).max(10).optional().default(3),

  // User-provided AI prompt for email generation
  prompt: z.string().trim().optional().default(""),

  // Schedule
  timezone: z.string().optional().default("Asia/Kolkata"),
  scheduleName: z.string().optional().default("Business Hours"),
  timingFrom: z.string().optional().default("09:00"),
  timingTo: z.string().optional().default("17:00"),
  days: z.array(z.number().int().min(1).max(7)).optional().default([1, 2, 3, 4, 5]),

  // Delay between steps
  delayBetweenSteps: z.coerce.number().int().min(0).optional().default(1),
  delayUnit: z.enum(["minutes", "hours", "days"]).optional().default("days"),
});

/**
 * POST /api/campaigns
 * Create a new Instantly campaign via API and auto-configure email templates.
 *
 * Body:
 *   { "name": "SaaS Founders Q2", "stepCount": 4, "prompt": "You are an SDR..." }
 *
 * Returns:
 *   { data: { id: "341e6a10-...", name: "...", stepCount: 4, prompt: "..." } }
 */
export const createNewCampaign = asyncHandler(async (req, res) => {
  const parsed = CreateCampaignSchema.parse(req.body);

  const campaign = await createCampaign({
    name: parsed.name,
    stepCount: parsed.stepCount,
    timezone: parsed.timezone,
    scheduleName: parsed.scheduleName,
    timingFrom: parsed.timingFrom,
    timingTo: parsed.timingTo,
    days: parsed.days,
    delayBetweenSteps: parsed.delayBetweenSteps,
    delayUnit: parsed.delayUnit,
  });

  // Persist campaign locally so we can look up the prompt later
  await Campaign.findOneAndUpdate(
    { instantlyCampaignId: campaign.id },
    {
      instantlyCampaignId: campaign.id,
      name: parsed.name,
      prompt: parsed.prompt,
      stepCount: parsed.stepCount,
    },
    { upsert: true, new: true }
  );

  res.status(201).json({
    data: {
      ...campaign,
      prompt: parsed.prompt,
    },
  });
});
