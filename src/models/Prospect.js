import mongoose from "mongoose";

const ProspectSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
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
      enum: ["pending", "generated", "in_campaign", "replied", "completed"],
      default: "pending",
      index: true
    },

    // 🚀 AI GENERATED SEQUENCE
    sequence: {
      step1: {
        subject: String,
        body: String,
        sent: { type: Boolean, default: false }
      },
      step2: {
        subject: String,
        body: String,
        sent: { type: Boolean, default: false }
      },
      step3: {
        subject: String,
        body: String,
        sent: { type: Boolean, default: false }
      }
    },

    // 🚀 TRACK CURRENT STEP (important)
    currentStep: {
      type: Number,
      default: 0 // 0 = not sent yet, 1,2,3 = sequence progress
    },

    // 🚀 REPLY HANDLING
    repliedAt: Date,

    reply_text: { type: String, trim: true },

    // 🚀 FORWARDING / SALES ACTION
    forwardedToSales: { type: Boolean, default: false },

    // A/B testing
    variant: { type: String, trim: true, default: "A", index: true },

    // 🔗 Instantly campaign lead reference
    instantlyLeadId: { type: String, trim: true, index: true, sparse: true }
  },
  { timestamps: true }
);

export const Prospect = mongoose.model("Prospect", ProspectSchema);

