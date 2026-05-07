import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { prospectRoutes } from "./routes/prospectRoutes.js";
import { webhookRoutes } from "./routes/webhookRoutes.js";
import { campaignRoutes } from "./routes/campaignRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { verifyAuth } from "./middleware/auth.js";
import { errorHandler } from "./utils/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildApp() {
  const app = express();

  app.use(helmet({ strictTransportSecurity: false }));
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/prospects", verifyAuth, prospectRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/campaigns", verifyAuth, campaignRoutes);

  // Serve built frontend in production
  const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");

  app.use(express.static(frontendDist));

  // SPA fallback — serve index.html for any non-API route
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendDist, "index.html"), (err) => {
      if (err) next();
    });
  });

  app.use(errorHandler);

  return app;
}

