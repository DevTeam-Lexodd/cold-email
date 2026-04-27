import { Router } from "express";
import {
  createProspect,
  exportProspectsCsv,
  generateProspects,
  listProspects,
  pushToInstantly,
  uploadProspects
} from "../controllers/prospectController.js";
import { uploadExcel } from "../utils/upload.js";

export const prospectRoutes = Router();

prospectRoutes.post("/", createProspect);
prospectRoutes.get("/", listProspects);
prospectRoutes.post("/generate", generateProspects);
// Catch multer errors (e.g. wrong file type) before they become unhandled
prospectRoutes.post("/upload", (req, res, next) => {
  uploadExcel.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: { message: "File too large (max 10 MB)" } });
      }
      return res.status(400).json({ error: { message: err.message || "File upload error" } });
    }
    next();
  });
}, uploadProspects);
prospectRoutes.get("/export", exportProspectsCsv);
prospectRoutes.post("/push-to-instantly", pushToInstantly);

