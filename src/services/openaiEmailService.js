import OpenAI from "openai";
import { env } from "../config/env.js";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

function buildPrompt({ company, role, painPoints, notes, prompt, name, stepCount = 3 }) {
  const pains = Array.isArray(painPoints) && painPoints.length ? painPoints : [];

  const firstName = (name || "").split(" ")[0] || "";

  // Build dynamic key list and step descriptions
  const stepKeys = [];
  const stepDescriptions = [];
  for (let i = 1; i <= stepCount; i++) {
    stepKeys.push(`step${i}_subject`, `step${i}_body`);
    const label =
      i === 1
        ? "initial outreach"
        : i === stepCount
          ? "final nudge with a different angle"
          : `short follow-up #${i - 1}`;
    stepDescriptions.push(`- Step ${i} = ${label}.`);
  }

  const lines = [
    `You are an expert B2B SDR writing a ${stepCount}-step cold email sequence.`,
    "",
    "Return ONLY valid JSON with keys:",
    stepKeys.join(", ") + ".",
    "",
    "Constraints:",
    "- Each email must be under 100 words.",
    ...stepDescriptions,
    "- Each email must feel human and different.",
    "- Always directly use the recipient name if provided (e.g., Hi John).",
    "- Do NOT use variables like {{first_name}} or placeholders.",
    "- Start naturally (Hi, Hello).",
    "- Include exactly ONE short CTA question per email.",
    "- Avoid spam words.",
    "- Keep subject lines under 6 words.",
    "",
    `Recipient name: ${firstName}`,
    `Company: ${company || ""}`,
    `Role: ${role || ""}`,
    `Pain points: ${pains.join("; ")}`,
    `Notes: ${notes || ""}`,
  ];

  // Inject user-provided campaign prompt if present
  if (prompt && prompt.trim()) {
    lines.push("", "Style / Tone / Strategy Instructions:", prompt.trim());
  }

  return lines.join("\n");
}

function safeJsonParse(text) {
  // Strip markdown code fences if present
  let cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract just the JSON object
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON object found in response");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

// Generates fully personalized emails (no template variables, uses real values)
export async function generateColdEmailSequence(data) {
  const prompt = buildPrompt(data);

  const resp = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const text = resp.choices?.[0]?.message?.content || "";

  const parsed = safeJsonParse(text);

  // Return all stepX_subject / stepX_body keys found (dynamic step count)
  const result = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (/^step\d+_(subject|body)$/.test(key)) {
      result[key] = value;
    }
  }
  return result;
}
