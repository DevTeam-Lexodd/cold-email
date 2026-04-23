const POSITIVE_HINTS = [
  "interested",
  "sounds good",
  "let's do it",
  "let’s do it",
  "book",
  "schedule",
  "meeting",
  "demo",
  "yes",
  "please send"
];
const NEGATIVE_HINTS = [
  "not interested",
  "no thanks",
  "stop",
  "unsubscribe",
  "remove",
  "spam",
  "never",
  "don't email",
  "don’t email"
];

export function classifyReply(replyText) {
  const t = (replyText || "").toLowerCase();
  if (!t.trim()) return "unknown";
  if (NEGATIVE_HINTS.some((h) => t.includes(h))) return "negative";
  if (POSITIVE_HINTS.some((h) => t.includes(h))) return "positive";
  return "neutral";
}

export function scoreProspect({ company, role, painPoints, notes, replyType } = {}) {
  let score = 0;
  const has = (v) => (typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : false);

  if (has(company)) score += 10;
  if (has(role)) score += 10;
  if (has(painPoints)) score += 20;
  if (has(notes)) score += 10;

  if (replyType === "positive") score += 50;
  if (replyType === "neutral") score += 10;
  if (replyType === "negative") score -= 40;

  return Math.max(0, Math.min(100, score));
}

