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

    // Scheduling
    timezone: { type: String, default: "Asia/Kolkata" },
    scheduleName: { type: String, default: "Business Hours" },
    timingFrom: { type: String, default: "09:00" },
    timingTo: { type: String, default: "17:00" },
    days: { type: [Number], default: [1, 2, 3, 4, 5] },

    // Sending behavior
    delayBetweenSteps: { type: Number, default: 1 },
    delayUnit: {
      type: String,
      enum: ["minutes", "hours", "days"],
      default: "days",
    },

    // Whether the campaign was successfully activated in Instantly
    isActive: { type: Boolean, default: false },

    // Live campaign status from Instantly: "active", "paused", "draft"
    status: { type: String, default: "draft", lowercase: true, trim: true },
  },
  { timestamps: true }
);

export const Campaign = mongoose.model("Campaign", CampaignSchema);