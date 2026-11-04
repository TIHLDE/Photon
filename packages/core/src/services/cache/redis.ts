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

/**
 * `INCR` with a fixed window, in one atomic step.
 *
 * Only the increment that creates the key sets its expiry, so the window runs
 * from the first hit instead of sliding with each one.
 *
 * A value that is not an integer is replaced rather than failing. Better Auth
 * 1.6 stored rate-limit entries as JSON objects under the same keys 1.7
 * counts on, and plain `INCR` answers those with "value is not an integer" —
 * a 500 for that address until the old entry expired. Such a key can only
 * hold a 1.6 leftover, so starting the count over loses nothing.
 */
const INCREMENT_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if current and not string.match(current, "^%-?%d+$") then
    redis.call("DEL", KEYS[1])
end
local count = redis.call("INCR", KEYS[1])
if count == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
`;

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

    async delete(key: string) {
        const redis = this.#redis;
        await redis.del(key);
    }

    async getAndDelete(key: string): Promise<unknown> {
        return await this.#redis.getDel(key);
    }

    async increment(key: string, ttl: number): Promise<number> {
        const count = await this.#redis.eval(INCREMENT_SCRIPT, {
            keys: [key],
            arguments: [String(ttl)],
        });
        return Number(count);
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
