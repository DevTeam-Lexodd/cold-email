import OpenAI from "openai";
import { env } from "../config/env.js";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

function buildPrompt({ company, role, painPoints, notes, variant }) {
  const pains = Array.isArray(painPoints) && painPoints.length ? painPoints : [];
  const styleHint =
    variant === "B"
      ? "Slightly more direct and benefit-led. Still polite, not spammy."
      : "Warm, concise, professional. Avoid hype.";

  return [
    "You are an expert B2B SDR writing a short personalized cold email.",
    "Return ONLY valid JSON with keys: subject, body.",
    "Constraints:",
    "- Body ~120 words max (strict).",
    "- No markdown.",
    "- No placeholders like <name>.",
    "- 1 short CTA question at the end.",
    "",
    `Company: ${company || ""}`,
    `Role: ${role || ""}`,
    `Pain points: ${pains.join("; ")}`,
    `Notes: ${notes || ""}`,
    `Variant: ${variant || "A"}`,
    `Style: ${styleHint}`
  ].join("\n");
}

function safeJsonParse(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("Empty OpenAI response");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Invalid JSON from OpenAI");
  }
}

export async function generateColdEmail({ company, role, painPoints, notes, variant }) {
  const prompt = buildPrompt({ company, role, painPoints, notes, variant });

  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
    temperature: 0.7
  });

  const text =
    resp.output_text ||
    resp.output?.map((o) => o?.content?.map((c) => c?.text).filter(Boolean).join("\n")).filter(Boolean).join("\n") ||
    "";

  const json = safeJsonParse(text);
  const subject = typeof json.subject === "string" ? json.subject.trim() : "";
  const body = typeof json.body === "string" ? json.body.trim() : "";

  if (!subject || !body) throw new Error("OpenAI JSON missing subject/body");

  return { subject, body };
}

