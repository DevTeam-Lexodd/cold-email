import { stringify } from "csv-stringify/sync";

export function prospectsToInstantlyCsv(prospects) {
  const records = prospects.map((p) => ({
    email: p.email || "",
    first_name: (p.name || "").split(" ").filter(Boolean)[0] || "",
    company: p.company || "",
    subject: p.ai_subject || "",
    body: p.ai_body || ""
  }));

  return stringify(records, {
    header: true,
    columns: ["email", "first_name", "company", "subject", "body"]
  });
}

