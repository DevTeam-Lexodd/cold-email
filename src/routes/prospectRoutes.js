import { Router } from "express";
import {
  createProspect,
  exportProspectsCsv,
  generateProspects,
  listProspects
} from "../controllers/prospectController.js";

export const prospectRoutes = Router();

prospectRoutes.post("/", createProspect);
prospectRoutes.get("/", listProspects);
prospectRoutes.post("/generate", generateProspects);
prospectRoutes.get("/export", exportProspectsCsv);

