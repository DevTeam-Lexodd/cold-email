import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.string().optional().default("development"),
  PORT: z.coerce.number().int().positive().optional().default(3000),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  REDIS_HOST: z.string().min(1, "REDIS_HOST is required"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OWNER_EMAIL: z
    .preprocess((v) => (v === "" ? undefined : v), z.string().email().optional()),
  GRAPH_TENANT_ID: z
    .preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  GRAPH_CLIENT_ID: z
    .preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  GRAPH_CLIENT_SECRET: z
    .preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  GRAPH_USER_ID: z
    .preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  INSTANTLY_API_KEY: z
    .preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  INSTANTLY_CAMPAIGN_ID: z
    .preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  INSTANTLY_DEFAULT_CAMPAIGN_ID: z
    .preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
});

export const env = EnvSchema.parse(process.env);
