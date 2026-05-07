import { Redis } from "ioredis";
import { getRedisConnection } from "./redis.js";
import { logger } from "../utils/logger.js";

export function createRedisClient(label = "redis") {
  const client = new Redis(getRedisConnection());

  client.on("error", (err) => logger.error({ err, label }, "Redis error"));
  client.on("connect", () => logger.info({ label }, "Redis connecting"));
  client.on("ready", () => logger.info({ label }, "Redis ready"));

  return client;
}

