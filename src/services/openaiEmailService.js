import OpenAI from "openai";
import { env } from "../config/env.js";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

function buildPrompt({ company, role, painPoints, notes, variant, name }) {
  const pains = Array.isArray(painPoints) && painPoints.length ? painPoints : [];

  const firstName = (name || "").split(" ")[0] || "";

  const styleHint =
    variant === "B"
      ? "Slightly more direct and benefit-led. Still polite, not spammy."
      : "Warm, concise, professional. Avoid hype.";

  return [
    "You are an expert B2B SDR writing a 3-step cold email sequence.",
    "",
    "Return ONLY valid JSON with keys:",
    "step1_subject, step1_body, step2_subject, step2_body, step3_subject, step3_body.",
    "",
    "Constraints:",
    "- Each email must be under 100 words.",
    "- Step 1 = initial outreach.",
    "- Step 2 = short follow-up reminder.",
    "- Step 3 = final nudge with a different angle.",
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
    `Variant: ${variant || "A"}`,
    `Style: ${styleHint}`
  ].join("\n");
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    return JSON.parse(text.slice(start, end + 1));
  }
}

// Generates fully personalized emails (no template variables, uses real values)
export async function generateColdEmailSequence(data) {
  const prompt = buildPrompt(data);

  const resp = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7
  });

  const text = resp.choices?.[0]?.message?.content || "";

  const parsed = safeJsonParse(text);

  return {
    step1_subject: parsed.step1_subject,
    step1_body: parsed.step1_body,
    step2_subject: parsed.step2_subject,
    step2_body: parsed.step2_body,
    step3_subject: parsed.step3_subject,
    step3_body: parsed.step3_body
  };
}
