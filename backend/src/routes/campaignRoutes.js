import { Router } from "express";
import {
  createNewCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
} from "../controllers/campaignController.js";

export const campaignRoutes = Router();

campaignRoutes.post("/", createNewCampaign);
campaignRoutes.get("/", listCampaigns);
campaignRoutes.get("/:id", getCampaign);
campaignRoutes.patch("/:id", updateCampaign);
