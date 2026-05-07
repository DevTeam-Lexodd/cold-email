import { env } from "./env.js";

export function getRedisConnection() {
  return {
    host: env.REDIS_HOST,
    port: Number(env.REDIS_PORT),
    ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
    retryStrategy(times) {
      if (times > 30) return undefined;
      return Math.min(times * 200, 5000);
    },
    lazyConnect: true,
    maxRetriesPerRequest: null,
  };
}

