import { Worker } from "bullmq";
import { connectDb } from "../config/db.js";
import { EMAIL_QUEUE_NAME } from "../queue/emailQueue.js";
import { getRedisConnection } from "../config/redis.js";
import { Prospect } from "../models/Prospect.js";
import { generateColdEmailSequence } from "../services/openaiEmailService.js";
import { logger } from "../utils/logger.js";
import { scoreProspect } from "../services/leadScoringService.js";
import { addLeadToCampaign } from "../services/instantlyService.js";

async function start() {
  console.log("🚀 Worker booting...");

  await connectDb();
  console.log("✅ MongoDB connected (worker)");

  const worker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => {
  console.log("🔥 Processing job:", job.id, job.data);

  try {
    const { prospectId } = job.data || {};
    if (!prospectId) throw new Error("Missing prospectId");

    const prospect = await Prospect.findById(prospectId).exec();

    if (!prospect) {
      console.log("⚠️ Prospect not found:", prospectId);
      return { skipped: true };
    }

    // ✅ Skip if already generated
    if (prospect.status === "generated" && prospect.sequence?.step1?.subject) {
      console.log("⏩ Already generated, skipping:", prospectId);
      return { alreadyGenerated: true };
    }

    console.log("🤖 Calling OpenAI...");
 
    const {
      step1_subject,
      step1_body,
      step2_subject,
      step2_body,
      step3_subject,
      step3_body
    } = await generateColdEmailSequence({
      name: prospect.name,
      company: prospect.company,
      role: prospect.role,
      painPoints: prospect.painPoints,
      notes: prospect.notes,
      variant: prospect.variant,
    });

    console.log("✅ OpenAI response received");

    // ✅ SAVE FULL SEQUENCE
    prospect.sequence = {
      step1: {
        subject: step1_subject,
        body: step1_body,
        sent: false,
      },
      step2: {
        subject: step2_subject,
        body: step2_body,
        sent: false,
      },
      step3: {
        subject: step3_subject,
        body: step3_body,
        sent: false,
      },
    };

    // ✅ Update status
    prospect.status = "generated";

    // ✅ Score lead
    prospect.score = scoreProspect({
      company: prospect.company,
      role: prospect.role,
      painPoints: prospect.painPoints,
      notes: prospect.notes,
      replyType: prospect.reply_type,
    });

    await prospect.save();

    console.log("💾 Prospect updated:", prospectId);

    // 🚀 AUTO-PUSH to Instantly campaign (fire-and-forget, don't fail the job)
    try {
      console.log("📤 Pushing lead to Instantly...");
      const leadResult = await addLeadToCampaign({
        email: prospect.email,
        first_name: (prospect.name || "").split(" ").filter(Boolean)[0] || "",
        company: prospect.company,
        payload: {
          step1_subject: step1_subject,
          step1_body: step1_body,
          step2_subject: step2_subject,
          step2_body: step2_body,
          step3_subject: step3_subject,
          step3_body: step3_body,
        },
      });

      if (leadResult?.id) {
        prospect.instantlyLeadId = leadResult.id;
        await prospect.save();
        console.log("✅ Lead pushed to Instantly:", leadResult.id);
      }
    } catch (instantlyErr) {
      console.error("⚠️ Instantly push failed (lead saved locally):", instantlyErr.message);
      // Don't fail the job — prospect is already generated & saved
    }

    return { prospectId, status: "generated" };

  } catch (err) {
    console.error("❌ Job processing failed:", err);
    throw err;
  }
},
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );

  // 🔥 ADD THESE (VERY IMPORTANT)
  worker.on("ready", () => {
    console.log("✅ Worker is ready and listening...");
  });

  worker.on("active", (job) => {
    console.log("⚡ Job started:", job.id);
  });

  worker.on("completed", (job, result) => {
    console.log("✅ Job completed:", job.id, result);
  });

  worker.on("failed", (job, err) => {
    console.error("❌ Job failed:", job?.id, err);
  });

  worker.on("error", (err) => {
    console.error("❌ Worker error:", err);
  });

  const shutdown = async (signal) => {
    console.log("🛑 Worker shutting down:", signal);
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((e) => {
  console.error("🔥 Worker fatal error:", e);
  process.exit(1);
});

