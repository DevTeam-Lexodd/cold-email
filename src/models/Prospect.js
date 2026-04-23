import mongoose from "mongoose";

const ProspectSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },

    email: {
      type: String,
      required: true,
      unique: true, // ✅ enough (creates index automatically)
      trim: true,
      lowercase: true
    },

    company: { type: String, trim: true },
    role: { type: String, trim: true },

    painPoints: [{ type: String, trim: true }],
    notes: { type: String, trim: true },

    status: {
      type: String,
      enum: ["pending", "generated", "sent", "replied"],
      default: "pending",
      index: true
    },

    ai_subject: { type: String, trim: true },
    ai_body: { type: String, trim: true },

    reply_text: { type: String, trim: true },
    reply_type: {
      type: String,
      enum: ["positive", "negative", "neutral", "unknown"],
      default: "unknown"
    },

    score: { type: Number, default: 0, index: true },
    variant: { type: String, trim: true, default: "A", index: true }
  },
  { timestamps: true }
);

export const Prospect = mongoose.model("Prospect", ProspectSchema);

