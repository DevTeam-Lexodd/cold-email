import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: { message: "Not Found" } });
}

export function errorHandler(err, req, res, next) {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message
    }));
    return res.status(400).json({
      error: { message: "Validation error", details }
    });
  }

  const status = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message = status === 500 ? "Internal Server Error" : err?.message || "Error";
  const payload = {
    error: {
      message,
      ...(err?.details ? { details: err.details } : {})
    }
  };
  res.status(status).json(payload);
}

