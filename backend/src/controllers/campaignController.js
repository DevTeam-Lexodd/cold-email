import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/errors.js";
import { createCampaign as createInstantlyCampaign, getCampaignLiveStatus } from "../services/instantlyService.js";
import { Campaign } from "../models/Campaign.js";
import { Prospect } from "../models/Prospect.js";

const CreateCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  stepCount: z.coerce.number().int().min(1).max(10).optional().default(3),
  prompt: z.string().trim().optional().default(""),
  timezone: z.string().optional().default("Asia/Kolkata"),
  scheduleName: z.string().optional().default("Business Hours"),
  timingFrom: z.string().optional().default("09:00"),
  timingTo: z.string().optional().default("17:00"),
  days: z.array(z.number().int().min(1).max(7)).optional().default([1, 2, 3, 4, 5]),
  delayBetweenSteps: z.coerce.number().int().min(0).optional().default(1),
  delayUnit: z.enum(["minutes", "hours", "days"]).optional().default("days"),
});

const UpdateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  prompt: z.string().trim().optional(),
});

/**
 * POST /api/campaigns
 */
export const createNewCampaign = asyncHandler(async (req, res) => {
  const parsed = CreateCampaignSchema.parse(req.body);

  const campaign = await createInstantlyCampaign({
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

  await Campaign.findOneAndUpdate(
    { instantlyCampaignId: campaign.id },
    {
      instantlyCampaignId: campaign.id,
      name: parsed.name,
      prompt: parsed.prompt,
      stepCount: parsed.stepCount,
      timezone: parsed.timezone,
      scheduleName: parsed.scheduleName,
      timingFrom: parsed.timingFrom,
      timingTo: parsed.timingTo,
      days: parsed.days,
      delayBetweenSteps: parsed.delayBetweenSteps,
      delayUnit: parsed.delayUnit,
      isActive: campaign.activated || false,
      status: campaign.activated ? "active" : "draft",
    },
    { upsert: true, new: true }
  );

  res.status(201).json({ data: { ...campaign, prompt: parsed.prompt } });
});

/**
 * GET /api/campaigns
 * List all campaigns with prospect counts.
 */
/**
 * Sync a single campaign's live status from Instantly and update DB if changed.
 */
async function syncCampaignStatus(campaign) {
  try {
    const { isActive, status } = await getCampaignLiveStatus(campaign.instantlyCampaignId);
    if (campaign.isActive !== isActive || campaign.status !== status) {
      await Campaign.updateOne(
        { instantlyCampaignId: campaign.instantlyCampaignId },
        { $set: { isActive, status } }
      );
      campaign.isActive = isActive;
      campaign.status = status;
      console.log(
        `🔄 Synced campaign "${campaign.name}" (${campaign.instantlyCampaignId}): ` +
        `${status}`
      );
    }
  } catch (err) {
    // Don't fail the request if Instantly API is unreachable
    console.warn(`⚠️ Could not sync status for ${campaign.instantlyCampaignId}: ${err.message}`);
  }
}

export const listCampaigns = asyncHandler(async (_req, res) => {
  const campaigns = await Campaign.find({}).sort({ updatedAt: -1 }).lean();
  const counts = await Prospect.aggregate([
    { $match: { campaignId: { $in: campaigns.map((c) => c.instantlyCampaignId) } } },
    {
      $group: {
        _id: "$campaignId",
        total: { $sum: 1 },
        generated: {
          $sum: {
            $cond: [{ $in: ["$status", ["generated", "sent", "replied"]] }, 1, 0],
          },
        },
        replied: { $sum: { $cond: [{ $eq: ["$status", "replied"] }, 1, 0] } },
      },
    },
  ]);
  const countMap = {};
  for (const c of counts) countMap[c._id] = c;

  // Sync live status from Instantly for each campaign
  await Promise.allSettled(campaigns.map(syncCampaignStatus));

  const result = campaigns.map((c) => ({
    ...c,
    prospectCount: countMap[c.instantlyCampaignId]?.total || 0,
    generatedCount: countMap[c.instantlyCampaignId]?.generated || 0,
    repliedCount: countMap[c.instantlyCampaignId]?.replied || 0,
  }));

  res.json({ data: result });
});

/**
 * GET /api/campaigns/:id
 */
export const getCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ instantlyCampaignId: req.params.id }).lean();
  if (!campaign) throw new HttpError(404, "Campaign not found");

  // Sync live status from Instantly
  await syncCampaignStatus(campaign);

  const statusCounts = await Prospect.aggregate([
    { $match: { campaignId: campaign.instantlyCampaignId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const stats = {};
  let total = 0;
  for (const s of statusCounts) {
    stats[s._id] = s.count;
    total += s.count;
  }

  // Cumulative counts (prospects that have passed through a milestone)
  const generatedCount = (stats.generated || 0) +(stats.pushed || 0) + (stats.sent || 0) + (stats.replied || 0);
  const sentCount = (stats.sent || 0) + (stats.replied || 0);
  const repliedCount = stats.replied || 0;

  res.json({
    data: {
      ...campaign,
      stats,
      prospectCount: total,
      generatedCount,
      sentCount,
      repliedCount,
    },
  });
});

/**
 * PATCH /api/campaigns/:id
 * Update campaign name/prompt locally.
 */
export const updateCampaign = asyncHandler(async (req, res) => {
  const parsed = UpdateCampaignSchema.parse(req.body);
  const campaign = await Campaign.findOneAndUpdate(
    { instantlyCampaignId: req.params.id },
    { $set: parsed },
    { new: true }
  ).lean();
  if (!campaign) throw new HttpError(404, "Campaign not found");
  res.json({ data: campaign });
});

