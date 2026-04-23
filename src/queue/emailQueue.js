import { Queue } from "bullmq";

export const EMAIL_QUEUE_NAME = "emailQueue";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: { host: "127.0.0.1", port: 6379 },
  defaultJobOptions: {
    attempts: 3, // 🔁 retry
    backoff: { type: "exponential", delay: 2000 }, // ⏳ delay
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 }
  }
});

// 🔥 ADD THIS (VERY IMPORTANT)
emailQueue.on("error", (err) => {
  console.error("❌ Queue connection error:", err);
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

