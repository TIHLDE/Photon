import { type RedisClient, createRedisClient } from "@photon/core/cache";
import { env } from "./env";

let redisInstance: RedisClient | null = null;

/**
 * Get a singleton Redis client for use in standalone modules (e.g., Vipps).
 * For request-scoped code, prefer using the redis client from AppContext instead.
 */
export async function getRedis(): Promise<RedisClient> {
    if (!redisInstance) {
        redisInstance = await createRedisClient(env.REDIS_URL);
    }
    return redisInstance;
}
