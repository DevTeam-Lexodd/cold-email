import mongoose from "mongoose";

const CampaignSchema = new mongoose.Schema(
  {
    // The Instantly campaign UUID
    instantlyCampaignId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    name: { type: String, trim: true },

    // User-provided AI prompt/instructions for generating emails
    // e.g. "You are an SDR targeting SaaS CEOs. Keep it casual..."
    prompt: { type: String, trim: true, default: "" },

    stepCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Campaign = mongoose.model("Campaign", CampaignSchema);