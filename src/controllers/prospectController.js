import { z } from "zod";
import { Prospect } from "../models/Prospect.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/errors.js";
import { enqueueProspectGeneration } from "../queue/emailQueue.js";
import { prospectsToInstantlyCsv } from "../utils/csvExport.js";

const CreateProspectSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().email(),
  company: z.string().trim().optional(),
  role: z.string().trim().optional(),
  painPoints: z.array(z.string().trim()).optional().default([]),
  notes: z.string().trim().optional(),
  variant: z.enum(["A", "B"]).optional().default("A")
});

const GenerateSchema = z.object({
  prospectIds: z.array(z.string().trim().min(1)).optional(),
  status: z.enum(["pending", "generated", "sent", "replied"]).optional()
});

export const createProspect = asyncHandler(async (req, res) => {
  const input = CreateProspectSchema.parse(req.body || {});

  let prospect;
  console.log("Creating prospect with input:", input);
  try {
    prospect = await Prospect.create({
      ...input,
      status: "pending"
    });
  } catch (e) {
    if (e?.code === 11000) throw new HttpError(409, "Prospect email already exists");
    throw e;
  }

  try {
    console.log("👉 Adding job to queue...");
    await enqueueProspectGeneration(prospect._id.toString());
    console.log("✅ Job successfully added!");
  } catch (err) {
    console.error("❌ Queue error:", err);
    return res.status(500).json({ error: err.message });
  }

  res.status(201).json({ data: prospect });
});

export const listProspects = asyncHandler(async (req, res) => {
  const prospects = await Prospect.find().sort({ createdAt: -1 }).lean();
  res.json({ data: prospects });
});

export const generateProspects = asyncHandler(async (req, res) => {
  const input = GenerateSchema.parse(req.body || {});
  const filter = {};

  if (input.status) filter.status = input.status;
  if (input.prospectIds?.length) filter._id = { $in: input.prospectIds };

  const prospects = await Prospect.find(filter, { _id: 1 }).lean();
  const jobs = await Promise.all(prospects.map((p) => enqueueProspectGeneration(p._id.toString())));

  res.json({ queued: jobs.length });
});

export const exportProspectsCsv = asyncHandler(async (req, res) => {
  const prospects = await Prospect.find(
    { status: { $in: ["generated", "sent", "replied"] }, ai_subject: { $exists: true }, ai_body: { $exists: true } },
    { email: 1, name: 1, company: 1, ai_subject: 1, ai_body: 1 }
  )
    .sort({ updatedAt: -1 })
    .lean();

  const csv = prospectsToInstantlyCsv(prospects);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"instantly_prospects.csv\"");
  res.status(200).send(csv);
});

