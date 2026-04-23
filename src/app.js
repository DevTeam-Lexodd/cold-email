import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { prospectRoutes } from "./routes/prospectRoutes.js";
import { webhookRoutes } from "./routes/webhookRoutes.js";
import { errorHandler, notFound } from "./utils/errors.js";

export function buildApp() {
  const app = express();

  app.use(helmet());
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

  app.use("/api/prospects", prospectRoutes);
  app.use("/api/webhooks", webhookRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

