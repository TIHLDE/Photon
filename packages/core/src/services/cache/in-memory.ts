import { BaseCache } from "./base";

export class InMemoryCache extends BaseCache {
    #cache: Map<string, { value: unknown; expires: number }>;
    constructor() {
        super();
        this.#cache = new Map();
    }

    override async get(key: string): Promise<unknown> {
        const entry = this.#cache.get(key);
        if (entry == null) return undefined;
        const now = Date.now();
        if (entry.expires != -1 && entry.expires < now) {
            this.#cache.delete(key);
            return undefined;
        }
        return entry.value;
    }
    override async set(
        key: string,
        value: unknown,
        ttl?: number,
    ): Promise<void> {
        this.#cache.set(key, {
            value,
            expires: ttl != null ? Date.now() + ttl * 1000 : -1,
        });
    }

    override async getTTL(key: string): Promise<number | undefined> {
        const entry = this.#cache.get(key);
        if (entry == null) return undefined;
        if (entry.expires == -1) return undefined;
        return Math.floor((entry.expires - Date.now()) / 1000);
    }

    override async increment(key: string, ttl: number): Promise<number> {
        // No await between the read and the write, so concurrent callers
        // cannot interleave here.
        const now = Date.now();
        const entry = this.#cache.get(key);
        if (entry == null || (entry.expires != -1 && entry.expires < now)) {
            this.#cache.set(key, { value: 1, expires: now + ttl * 1000 });
            return 1;
        }
        const count = Number(entry.value) + 1;
        entry.value = count;
        return count;
    }

    override async delete(key: string): Promise<void> {
        this.#cache.delete(key);
    }
}
