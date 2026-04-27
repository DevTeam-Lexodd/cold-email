import { z } from "zod";
import XLSX from "xlsx";
import { Prospect } from "../models/Prospect.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/errors.js";
import { enqueueProspectGeneration } from "../queue/emailQueue.js";
import { prospectsToInstantlyCsv } from "../utils/csvExport.js";
import { addLeadToCampaign, bulkAddLeads } from "../services/instantlyService.js";

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

  // Queue generation in background (non-blocking — prospect already saved)
  try {
    console.log("👉 Adding job to queue...");
    await enqueueProspectGeneration(prospect._id.toString());
    console.log("✅ Job successfully added!");
  } catch (err) {
    console.error("❌ Queue error (prospect saved, will retry via worker):", err.message);
    // Don't fail the request — the prospect is already in the DB
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

export const uploadProspects = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new HttpError(400, "No file uploaded");
  }

  // Parse the uploaded file buffer
  const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert sheet to JSON array
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rows.length) {
    throw new HttpError(400, "File is empty or has no valid rows");
  }

  const results = {
    total: rows.length,
    created: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of rows) {
    // Normalize column names (case-insensitive, trim whitespace)
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
    const variant = (normalized.variant || "A").toUpperCase();

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
        painPoints: painPointsStr
          ? painPointsStr.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
          : [],
        notes: notes || undefined,
        variant: variant === "B" ? "B" : "A",
      });

      try {
        const prospect = await Prospect.create({ ...input, status: "pending" });
        // Queue generation for each prospect
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

export const pushToInstantly = asyncHandler(async (req, res) => {
  const { prospectIds } = req.body || {};

  let prospects;
  if (prospectIds?.length) {
    prospects = await Prospect.find({
      _id: { $in: prospectIds },
      status: "generated",
      sequence: { $exists: true },
    }).lean();
  } else {
    // Push all generated prospects not yet in Instantly
    prospects = await Prospect.find({
      status: "generated",
      instantlyLeadId: { $exists: false },
      "sequence.step1.subject": { $exists: true },
    }).lean();
  }

  if (!prospects.length) {
    return res.json({ pushed: 0, message: "No eligible prospects found" });
  }

  const results = [];
  for (const p of prospects) {
    try {
      const leadResult = await addLeadToCampaign({
        email: p.email,
        first_name: (p.name || "").split(" ").filter(Boolean)[0] || "",
        company: p.company,
        payload: {
          step1_subject: p.sequence?.step1?.subject || "",
          step1_body: p.sequence?.step1?.body || "",
          step2_subject: p.sequence?.step2?.subject || "",
          step2_body: p.sequence?.step2?.body || "",
          step3_subject: p.sequence?.step3?.subject || "",
          step3_body: p.sequence?.step3?.body || "",
        },
      });

      if (leadResult?.id) {
        await Prospect.updateOne({ _id: p._id }, { $set: { instantlyLeadId: leadResult.id } });
        results.push({ email: p.email, status: "pushed", instantlyLeadId: leadResult.id });
      }
    } catch (err) {
      results.push({ email: p.email, status: "failed", error: err.message });
    }
  }

  res.json({ pushed: results.length, results });
});

export const exportProspectsCsv = asyncHandler(async (req, res) => {
  const prospects = await Prospect.find(
  {
    status: { $in: ["generated", "sent", "replied"] },
    "sequence.step1.subject": { $exists: true }
  },
  {
    email: 1,
    name: 1,
    company: 1,
    sequence: 1
  }
)
  .sort({ updatedAt: -1 })
  .lean();

  const csv = prospectsToInstantlyCsv(prospects);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"instantly_prospects.csv\"");
  res.status(200).send(csv);
});

