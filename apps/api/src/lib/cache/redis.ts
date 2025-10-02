import { createClient } from "redis";
import { env } from "~/lib/env";

export type RedisClientType = ReturnType<typeof createClient>;

/**
 * Factory function to create and connect a Redis client.
 * Use this for dependency injection and testing.
 */
export async function createRedisClient(url: string): Promise<RedisClientType> {
    const client = createClient({ url });
    client.on("error", (err) => {
        console.error("Redis client error:", err);
    });
    await client.connect();
    await client.ping();
    return client;
}

/**
 * Singleton Redis client for backward compatibility.
 * Prefer using createRedisClient() and dependency injection in new code.
 */
let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType> | null = null;

async function connect(): Promise<RedisClientType> {
    if (client) return client;
    if (connectPromise) return connectPromise;

    connectPromise = (async () => {
        const c = await createRedisClient(env.REDIS_URL);
        client = c;
        return c;
    })();

    return connectPromise;
}

export async function getRedis(): Promise<RedisClientType> {
    return connect();
}
