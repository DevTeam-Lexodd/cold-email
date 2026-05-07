import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export function getRedisConnection() {
  return {
    host: env.REDIS_HOST,
    port: Number(env.REDIS_PORT),
    maxRetriesPerRequest: null, // required by BullMQ
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 30) return undefined; // give up after ~5 min
      return Math.min(times * 200, 5000); // exponential backoff capped at 5s
    },
    lazyConnect: true,
  };
}

