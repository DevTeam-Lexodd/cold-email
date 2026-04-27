import { stringify } from "csv-stringify/sync";

export function prospectsToInstantlyCsv(prospects) {
  const records = prospects.map((p) => ({
    email: p.email || "",
    first_name: (p.name || "").split(" ").filter(Boolean)[0] || "",
    company: p.company || "",

    // ✅ STEP 1
    step1_subject: p.sequence?.step1?.subject || "",
    step1_body: p.sequence?.step1?.body || "",

    // ✅ STEP 2
    step2_subject: p.sequence?.step2?.subject || "",
    step2_body: p.sequence?.step2?.body || "",

    // ✅ STEP 3
    step3_subject: p.sequence?.step3?.subject || "",
    step3_body: p.sequence?.step3?.body || "",
  }));

  return stringify(records, {
    header: true,
    columns: [
      "email",
      "first_name",
      "company",
      "step1_subject",
      "step1_body",
      "step2_subject",
      "step2_body",
      "step3_subject",
      "step3_body"
    ]
  });
}

