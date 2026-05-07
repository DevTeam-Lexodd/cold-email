import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = [".xlsx", ".xls", ".csv"];
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only Excel (.xlsx, .xls) or CSV files are allowed"), false);
  }
};

export const uploadExcel = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});