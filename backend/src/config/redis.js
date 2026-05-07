import { env } from "./env.js";

export function getRedisConnection() {
  return {
    host: env.REDIS_HOST,
    port: Number(env.REDIS_PORT)
  };
}

