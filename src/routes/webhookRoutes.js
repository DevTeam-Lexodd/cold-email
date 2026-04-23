import { Router } from "express";
import { handleReplyWebhook } from "../controllers/webhookController.js";

export const webhookRoutes = Router();

webhookRoutes.post("/reply", handleReplyWebhook);

