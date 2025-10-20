import { createClient } from "redis";
import { env } from "~/lib/env";

export type RedisClient = ReturnType<typeof createClient>;

/**
 * Factory function to create and connect a Redis client.
 * Use this for dependency injection and testing.
 */
export async function createRedisClient(url: string): Promise<RedisClient> {
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
let client: RedisClient | null = null;
let connectPromise: Promise<RedisClient> | null = null;

async function connect(): Promise<RedisClient> {
    if (client) return client;
    if (connectPromise) return connectPromise;

    connectPromise = (async () => {
        const c = await createRedisClient(env.REDIS_URL);
        client = c;
        return c;
    })();

    return connectPromise;
}

export async function getRedis(): Promise<RedisClient> {
    return connect();
}
