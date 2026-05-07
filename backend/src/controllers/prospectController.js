import { z } from "zod";
import XLSX from "xlsx";
import { Prospect } from "../models/Prospect.js";
import { Campaign } from "../models/Campaign.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/errors.js";
import { enqueueProspectGeneration } from "../queue/emailQueue.js";

const CreateProspectSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().email(),
  company: z.string().trim().optional(),
  role: z.string().trim().optional(),
  painPoints: z.array(z.string().trim()).optional().default([]),
  notes: z.string().trim().optional(),
  campaignId: z.string().trim().optional(),
});

const UpdateProspectSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  company: z.string().trim().optional(),
  role: z.string().trim().optional(),
  painPoints: z.array(z.string().trim()).optional(),
  notes: z.string().trim().optional(),
  campaignId: z.string().trim().optional(),
});

/**
 * POST /api/prospects/upload
 * Bulk upload via CSV/Excel file.
 */
export const uploadProspects = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new HttpError(400, "No file uploaded");
  }

  const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rows.length) {
    throw new HttpError(400, "File is empty or has no valid rows");
  }

  // Optional campaignId from form data (applies to all rows as default)
  const defaultCampaignId = req.body.campaignId || null;
  if (defaultCampaignId) {
    const campaign = await Campaign.findOne({ instantlyCampaignId: defaultCampaignId });
    if (!campaign) {
      throw new HttpError(400, "Campaign not found");
    }
  }

  const results = { total: rows.length, created: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase()] = String(value).trim();
    }

    const email = normalized.email || normalized["email address"] || "";
    const name = normalized.name || normalized["first name"] || normalized["full name"] || "";
    const company = normalized.company || normalized["company name"] || "";
    const role = normalized.role || normalized["job title"] || normalized["title"] || "";
    const painPointsStr = normalized.painpoints || normalized["pain points"] || "";
    const notes = normalized.notes || "";
    const campaignId = defaultCampaignId || "";

    if (!email) {
      results.errors.push({ row, reason: "Missing email address" });
      continue;
    }

    try {
      const input = CreateProspectSchema.parse({
        email,
        name: name || undefined,
        company: company || undefined,
        role: role || undefined,
        painPoints: painPointsStr ? painPointsStr.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [],
        notes: notes || undefined,
        campaignId: campaignId || undefined,
      });

      try {
        const prospect = await Prospect.create({ ...input, status: "pending" });
        await enqueueProspectGeneration(prospect._id.toString());
        results.created++;
      } catch (e) {
        if (e?.code === 11000) {
          results.skipped++;
          results.errors.push({ email, reason: "Duplicate email (already exists)" });
        } else {
          throw e;
        }
      }
    } catch (e) {
      results.errors.push({ email, reason: e.message });
    }
  }

  res.status(201).json({ data: results });
});

/**
 * POST /api/prospects
 * Create a single prospect manually.
 */
export const createProspect = asyncHandler(async (req, res) => {
  const input = CreateProspectSchema.parse(req.body);

  const exists = await Prospect.findOne({ email: input.email, campaignId: input.campaignId || null });
  if (exists) throw new HttpError(409, "A prospect with this email already exists");

  const prospect = await Prospect.create({ ...input, status: "pending" });
  await enqueueProspectGeneration(prospect._id.toString());

  res.status(201).json({ data: prospect });
});

/**
 * GET /api/prospects
 * List prospects with search, filter, and pagination.
 */
export const listProspects = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = {};

  // Search by email, name, company (case-insensitive)
  if (req.query.search) {
    const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { email: { $regex: escaped, $options: "i" } },
      { name: { $regex: escaped, $options: "i" } },
      { company: { $regex: escaped, $options: "i" } },
    ];
  }

  // Filter by status
  if (req.query.status) {
    filter.status = req.query.status;
  }

  // Filter by campaign
  if (req.query.campaignId) {
    filter.campaignId = req.query.campaignId;
  }

  const [prospects, total] = await Promise.all([
    Prospect.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Prospect.countDocuments(filter),
  ]);

  // Attach campaign names
  const campaignIds = [...new Set(prospects.filter((p) => p.campaignId).map((p) => p.campaignId))];
  let campaignMap = {};
  if (campaignIds.length) {
    const campaigns = await Campaign.find({ instantlyCampaignId: { $in: campaignIds } })
      .select("instantlyCampaignId name")
      .lean();
    for (const c of campaigns) campaignMap[c.instantlyCampaignId] = c.name;
  }

  const data = prospects.map((p) => ({
    ...p,
    campaignName: p.campaignId ? campaignMap[p.campaignId] || null : null,
  }));

  res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

/**
 * GET /api/prospects/:id
 * Get a single prospect by MongoDB _id.
 */
export const getProspect = asyncHandler(async (req, res) => {
  const prospect = await Prospect.findById(req.params.id).lean();
  if (!prospect) throw new HttpError(404, "Prospect not found");

  let campaignName = null;
  if (prospect.campaignId) {
    const c = await Campaign.findOne({ instantlyCampaignId: prospect.campaignId })
      .select("name")
      .lean();
    campaignName = c?.name || null;
  }

  res.json({ data: { ...prospect, campaignName } });
});

/**
 * PATCH /api/prospects/:id
 * Update prospect fields.
 */
export const updateProspect = asyncHandler(async (req, res) => {
  const input = UpdateProspectSchema.parse(req.body);

  const prospect = await Prospect.findByIdAndUpdate(
    req.params.id,
    { $set: input },
    { new: true, runValidators: true }
  ).lean();

  if (!prospect) throw new HttpError(404, "Prospect not found");

  res.json({ data: prospect });
});

/**
 * GET /api/stats/overview
 * Aggregate dashboard statistics.
 */
export const getOverviewStats = asyncHandler(async (_req, res) => {
  const [statusCounts, campaignCount, totalProspects] = await Promise.all([
    Prospect.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Campaign.countDocuments(),
    Prospect.countDocuments(),
  ]);

  const stats = {
    totalProspects,
    totalCampaigns: campaignCount,
  };
  for (const s of statusCounts) stats[s._id] = s.count;

  // Cumulative counts (prospects that have passed through a milestone) —
  // these only increase as prospects progress, unlike the snapshot stats above.
  const generatedCount =
    (stats.generated || 0) +
    (stats.pushed || 0) +
    (stats.sent || 0) +
    (stats.replied || 0);
  const pushedCount =
    (stats.pushed || 0) +
    (stats.sent || 0) +
    (stats.replied || 0);
  const sentCount = (stats.sent || 0) + (stats.replied || 0);
  stats.generatedCount = generatedCount;
  stats.pushedCount = pushedCount;
  stats.sentCount = sentCount;

  // Prospects per campaign
  const perCampaign = await Prospect.aggregate([
    { $match: { campaignId: { $exists: true, $ne: null } } },
    { $group: { _id: "$campaignId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  const campIds = perCampaign.map((c) => c._id);
  let campNames = {};
  if (campIds.length) {
    const camps = await Campaign.find({ instantlyCampaignId: { $in: campIds } })
      .select("instantlyCampaignId name")
      .lean();
    for (const c of camps) campNames[c.instantlyCampaignId] = c.name;
  }

  stats.perCampaign = perCampaign.map((c) => ({
    campaignId: c._id,
    campaignName: campNames[c._id] || c._id,
    count: c.count,
  }));

  // Recently updated prospects
  const recent = await Prospect.find({})
    .sort({ updatedAt: -1 })
    .limit(10)
    .select("name email company status campaignId updatedAt")
    .lean();
  const recentCampIds = [...new Set(recent.filter((r) => r.campaignId).map((r) => r.campaignId))];
  let recentCampNames = {};
  if (recentCampIds.length) {
    const camps = await Campaign.find({ instantlyCampaignId: { $in: recentCampIds } })
      .select("instantlyCampaignId name")
      .lean();
    for (const c of camps) recentCampNames[c.instantlyCampaignId] = c.name;
  }
  stats.recentActivity = recent.map((r) => ({
    ...r,
    campaignName: r.campaignId ? recentCampNames[r.campaignId] || null : null,
  }));

  res.json({ data: stats });
});