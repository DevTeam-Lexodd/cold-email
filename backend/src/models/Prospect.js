import mongoose from "mongoose";

const ProspectSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    company: { type: String, trim: true },
    role: { type: String, trim: true },

    painPoints: [{ type: String, trim: true }],
    notes: { type: String, trim: true },

    // 🚀 STATUS TRACKING
    status: {
      type: String,
      enum: ["pending", "generated", "pushed", "sent", "replied"],
      default: "pending",
      index: true
    },

    // 🚀 CAMPAIGN ROUTING — which Instantly campaign this lead belongs to
    campaignId: { type: String, trim: true, index: true },

    // 🚀 AI GENERATED SEQUENCE — stored as a Map so any number of steps work
    sequence: {
      type: Map,
      of: new mongoose.Schema(
        {
          subject: String,
          body: String,
          sent: { type: Boolean, default: false }
        },
        { _id: false }
      ),
      default: {}
    },

    // 🚀 TRACK CURRENT STEP (important)
    currentStep: {
      type: Number,
      default: 0 // 0 = not sent yet, 1,2,3,... = sequence progress
    },

    // 🚀 REPLY HANDLING
    repliedAt: Date,

    reply_text: { type: String, trim: true },

    // 📌 Which step of the sequence triggered the reply
    repliedToStep: { type: Number, default: null },

    // � FORWARDING / SALES ACTION
    forwardedToSales: { type: Boolean, default: false },

    // �🔗 Instantly campaign lead reference
    instantlyLeadId: { type: String, trim: true, index: true, sparse: true }
  },
  { timestamps: true }
);

// Email must be unique per campaign (same email can exist in different campaigns)
ProspectSchema.index({ email: 1, campaignId: 1 }, { unique: true });

export const Prospect = mongoose.model("Prospect", ProspectSchema);

/**
 * Migrate from the old global unique email index to the per-campaign compound index.
 * Call once at startup (idempotent).
 */
export async function migrateProspectIndexes() {
  const db = mongoose.connection.db;
  if (!db) return;

  const collection = db.collection("prospects");
  const indexes = await collection.listIndexes().toArray();

  // Drop the old global email_1 unique index if it still exists
  const oldEmailIndex = indexes.find(
    (idx) => idx.key && idx.key.email === 1 && idx.key.campaignId === undefined && idx.unique === true
  );
  if (oldEmailIndex) {
    await collection.dropIndex(oldEmailIndex.name);
    console.log("Dropped old global email_1 unique index → now per-campaign");
  }

  // Ensure the new compound index exists
  const hasCompoundIndex = indexes.some(
    (idx) => idx.key && idx.key.email === 1 && idx.key.campaignId === 1
  );
  if (!hasCompoundIndex) {
    await collection.createIndex({ email: 1, campaignId: 1 }, { unique: true });
    console.log("Created compound unique index: email_1_campaignId_1");
  }
}
