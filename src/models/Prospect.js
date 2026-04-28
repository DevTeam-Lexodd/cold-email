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

    // 🚀 FORWARDING / SALES ACTION
    forwardedToSales: { type: Boolean, default: false },

    // 🔗 Instantly campaign lead reference
    instantlyLeadId: { type: String, trim: true, index: true, sparse: true }
  },
  { timestamps: true }
);

export const Prospect = mongoose.model("Prospect", ProspectSchema);