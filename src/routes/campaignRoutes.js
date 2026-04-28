import { Router } from "express";
import { createNewCampaign } from "../controllers/campaignController.js";

export const campaignRoutes = Router();

campaignRoutes.post("/", createNewCampaign);