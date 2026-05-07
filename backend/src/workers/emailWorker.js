import { Worker } from "bullmq";
import { connectDb } from "../config/db.js";
import { EMAIL_QUEUE_NAME } from "../queue/emailQueue.js";
import { getRedisConnection } from "../config/redis.js";
import { Prospect } from "../models/Prospect.js";
import { Campaign } from "../models/Campaign.js";
import { generateColdEmailSequence } from "../services/openaiEmailService.js";
import { logger } from "../utils/logger.js";
import { addLeadToCampaign, getCampaignStepCount } from "../services/instantlyService.js";

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
    const existingSteps = [...(prospect.sequence?.keys() || [])];
    if (prospect.status === "generated" && existingSteps.length > 0) {
      console.log("⏩ Already generated, skipping:", prospectId);
      return { alreadyGenerated: true };
    }

    // 🎯 Derive stepCount from the campaign (NOT from prospect/CSV — avoids mismatch)
    const campaignId = prospect.campaignId || null;
    const stepCount = campaignId
      ? await getCampaignStepCount(campaignId)
      : 3; // fallback if no campaign assigned

    // 🎯 Fetch campaign prompt (user-provided AI instructions)
    let campaignPrompt = "";
    if (campaignId) {
      const campaignDoc = await Campaign.findOne({ instantlyCampaignId: campaignId }).lean();
      if (campaignDoc?.prompt) {
        campaignPrompt = campaignDoc.prompt;
      }
    }

    console.log(`🤖 Campaign has ${stepCount} steps — calling OpenAI...`);

    const sequenceData = await generateColdEmailSequence({
      name: prospect.name,
      company: prospect.company,
      role: prospect.role,
      painPoints: prospect.painPoints,
      notes: prospect.notes,
      prompt: campaignPrompt,
      stepCount,
    });

    console.log("✅ OpenAI response received");

    // ✅ SAVE FULL SEQUENCE as Map entries (dynamic step count)
    const customVariables = {};
    for (let i = 1; i <= stepCount; i++) {
      const subjectKey = `step${i}_subject`;
      const bodyKey = `step${i}_body`;
      const subject = sequenceData[subjectKey] || "";
      const body = sequenceData[bodyKey] || "";

      prospect.sequence.set(`step${i}`, {
        subject,
        body,
        sent: false,
      });

      customVariables[subjectKey] = subject;
      customVariables[bodyKey] = body;
    }

    // ✅ Update status
    prospect.status = "generated";

    await prospect.save();

    console.log("💾 Prospect updated:", prospectId);

    // 🚀 AUTO-PUSH to Instantly campaign (mandatory — fails the job if down)
    console.log(`📤 Pushing lead to Instantly campaign: ${campaignId || "default"}`);
    const leadResult = await addLeadToCampaign({
      email: prospect.email,
      first_name: (prospect.name || "").split(" ").filter(Boolean)[0] || "",
      company: prospect.company,
      campaignId,
      customVariables,
    });

    if (leadResult?.id) {
      prospect.instantlyLeadId = leadResult.id;
    }

    // Mark as pushed to Instantly (before actual send is confirmed via webhook)
    prospect.status = "pushed";
    await prospect.save();
    console.log("✅ Lead pushed to Instantly:", leadResult?.id);

    return { prospectId, status: "pushed", stepCount };

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