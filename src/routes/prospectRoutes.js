import { Router } from "express";
import { uploadProspects } from "../controllers/prospectController.js";
import { uploadExcel } from "../utils/upload.js";

export const prospectRoutes = Router();

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