import { createClient } from "redis";
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
