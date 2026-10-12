import { createClient } from "redis";
import { BaseCache } from "./base";

export async function createRedisClient(url: string) {
    const client = createClient({ url });
    client.on("error", (err) => {
        console.error("Redis client error:", err);
    });
    await client.connect();
    await client.ping();
    return client;
}

export type RedisClientType = Awaited<ReturnType<typeof createRedisClient>>;

export class RedisCache extends BaseCache {
    #redis: RedisClientType;
    constructor(redis: RedisClientType) {
        super();
        this.#redis = redis;
    }

    async get(key: string): Promise<unknown> {
        return await this.#redis.get(key);
    }

    async set(key: string, value: unknown, ttl?: number): Promise<void> {
        const stringValue =
            typeof value === "object" ? JSON.stringify(value) : String(value);
        if (typeof ttl === "number") {
            await this.#redis.setEx(key, ttl, stringValue);
        } else {
            await this.#redis.set(key, stringValue);
        }
    }

    async increment(key: string, ttl: number): Promise<number> {
        // One transaction, so a counter can never be left without an expiry
        // and block forever. NX: only the first hit in a window sets it.
        const [count] = await this.#redis
            .multi()
            .incr(key)
            .expire(key, ttl, "NX")
            .exec();
        return Number(count);
    }

    async delete(key: string) {
        const redis = this.#redis;
        await redis.del(key);
    }

    async getTTL(key: string) {
        const redis = this.#redis;

        const ttl = await redis.ttl(key);
        if (ttl <= 0) {
            return undefined;
        }
        return ttl;
    }

    static async create(url: string) {
        return new RedisCache(await createRedisClient(url));
    }
}
