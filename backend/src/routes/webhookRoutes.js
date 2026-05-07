import { Router } from "express";
import { handleReplyWebhook, handleEmailSentWebhook } from "../controllers/webhookController.js";

export const webhookRoutes = Router();

webhookRoutes.post("/reply", handleReplyWebhook);
webhookRoutes.post("/email-sent", handleEmailSentWebhook);

