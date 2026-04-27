import { z } from "zod";
import XLSX from "xlsx";
import { Prospect } from "../models/Prospect.js";
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
  variant: z.enum(["A", "B"]).optional().default("A")
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


