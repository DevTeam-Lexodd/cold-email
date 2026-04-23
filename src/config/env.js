import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.string().optional().default("development"),
  PORT: z.coerce.number().int().positive().optional().default(3000),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  REDIS_HOST: z.string().min(1, "REDIS_HOST is required"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required")
});

export const env = EnvSchema.parse(process.env);
