import { createClient } from "redis";
import { BaseCache } from ".";

async function createNewClient(url: string) {
    const client = createClient({ url });
    client.on("error", (err) => {
        console.error("Redis client error:", err);
    });
    await client.connect();
    await client.ping();
    return client;
}

export type RedisClientType = Awaited<ReturnType<typeof createNewClient>>;

export class RedisCache extends BaseCache {
    #redis: RedisClientType;
    constructor(redis: RedisClientType) {
        super();
        this.#redis = redis;
    }

    async get(key: string): Promise<unknown> {
        return await this.#redis.get(key);
    }

    async set(key: string, value: string, ttl?: number): Promise<void> {
        if (typeof ttl === "number") {
            await this.#redis.setEx(key, ttl, value);
        } else {
            await this.#redis.set(key, value);
        }
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
        return new RedisCache(await createNewClient(url));
    }
}
