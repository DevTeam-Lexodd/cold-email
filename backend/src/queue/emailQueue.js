import { Queue } from "bullmq";
import { getRedisConnection } from "../config/redis.js";

export const EMAIL_QUEUE_NAME = "emailQueue";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3, // 🔁 retry
    backoff: { type: "exponential", delay: 2000 }, // ⏳ delay
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 }
  }
});

// 🔥 Log connection errors but rate-limited to avoid spam
let lastErrorTime = 0;
emailQueue.on("error", (err) => {
  const now = Date.now();
  if (now - lastErrorTime > 30000) { // log at most once every 30s
    console.error("❌ Queue connection error:", err.message);
    lastErrorTime = now;
  }
});

export async function enqueueProspectGeneration(prospectId) {
  console.log("🚀 Adding job to BullMQ...");

  try {
    const job = await emailQueue.add(
      "generateEmail",
      { prospectId },
      { jobId: `prospect_${prospectId}` } // ✅ FIXED
    );

    console.log("✅ Job added:", job.id);
    return job;

  } catch (err) {
    console.error("❌ BullMQ add error:", err);
    throw err;
  }
}

