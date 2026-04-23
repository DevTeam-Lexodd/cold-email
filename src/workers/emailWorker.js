import { Worker } from "bullmq";
import { connectDb } from "../config/db.js";
import { EMAIL_QUEUE_NAME } from "../queue/emailQueue.js";
import { Prospect } from "../models/Prospect.js";
import { generateColdEmail } from "../services/openaiEmailService.js";
import { logger } from "../utils/logger.js";
import { scoreProspect } from "../services/leadScoringService.js";

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

        if (prospect.status === "generated" && prospect.ai_subject && prospect.ai_body) {
          console.log("⏩ Already generated, skipping:", prospectId);
          return { alreadyGenerated: true };
        }

        console.log("🤖 Calling OpenAI...");

        const { subject, body } = await generateColdEmail({
          company: prospect.company,
          role: prospect.role,
          painPoints: prospect.painPoints,
          notes: prospect.notes,
          variant: prospect.variant,
        });

        console.log("✅ OpenAI response received");

        prospect.ai_subject = subject;
        prospect.ai_body = body;
        prospect.status = "generated";

        prospect.score = scoreProspect({
          company: prospect.company,
          role: prospect.role,
          painPoints: prospect.painPoints,
          notes: prospect.notes,
          replyType: prospect.reply_type,
        });

        await prospect.save();

        console.log("💾 Prospect updated:", prospectId);

        return { prospectId, status: "generated" };

      } catch (err) {
        console.error("❌ Job processing failed:", err);
        throw err;
      }
    },
    {
      connection: {
        host: "127.0.0.1",
        port: 6379,
      },
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

