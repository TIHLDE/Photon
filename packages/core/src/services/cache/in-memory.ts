import { BaseCache } from "./base";

export class InMemoryCache extends BaseCache {
    #cache: Map<string, { value: unknown; expires: number }>;
    constructor() {
        super();
        this.#cache = new Map();
    }

    override async get(key: string): Promise<unknown> {
        return this.#live(key)?.value;
    }

    /**
     * The entry at `key` if it has not expired, dropping it if it has.
     *
     * Synchronous on purpose: `getAndDelete` and `increment` build on it, and
     * an `await` between their read and their write would let two concurrent
     * callers both read the same value — both consuming one verification
     * token, or both counting the same rate-limit hit as the first.
     */
    #live(key: string): { value: unknown; expires: number } | undefined {
        const entry = this.#cache.get(key);
        if (entry == null) return undefined;
        if (entry.expires != -1 && entry.expires < Date.now()) {
            this.#cache.delete(key);
            return undefined;
        }
        return entry;
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

    override async delete(key: string): Promise<void> {
        this.#cache.delete(key);
    }

    override async getAndDelete(key: string): Promise<unknown> {
        const value = this.#live(key)?.value;
        this.#cache.delete(key);
        return value;
    }

    override async increment(key: string, ttl: number): Promise<number> {
        const entry = this.#live(key);
        const current = Number(entry?.value);
        // Same rule as the Redis script: a missing or non-integer value starts
        // a new window, and only that first hit sets the expiry.
        if (!entry || !Number.isInteger(current)) {
            this.#cache.set(key, {
                value: 1,
                expires: Date.now() + ttl * 1000,
            });
            return 1;
        }
        entry.value = current + 1;
        return current + 1;
    }
}
