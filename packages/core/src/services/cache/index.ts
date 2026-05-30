import z from "zod";

type CachifyParams<T extends z.ZodType> = {
    key: string;
    fn: () => Promise<z.input<T>>;
    schema: T;
    ttlSeconds?: number;
    validateCache?: (cachedValue: z.output<T>) => boolean;
};

type CachifyResponse<T extends z.ZodType> = {
    data: z.output<T>;
    info: {
        cached: boolean;
        ttl: number | undefined;
    };
};

export interface CacheService {
    get(key: string): Promise<unknown>;
    set(key: string, value: string, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;

    getTTL: (key: string) => Promise<number | undefined>;
    delete: (key: string) => Promise<void>;

    getString: (key: string) => Promise<string | undefined>;
    setString: (key: string, value: string, ttl?: number) => Promise<void>;

    getObject: <T>(key: string) => Promise<T | undefined>;
    setObject: <T>(key: string, value: T, ttl?: number) => Promise<void>;

    cachifyValidate<T extends z.ZodType>(
        params: CachifyParams<T>,
    ): Promise<CachifyResponse<T>>;
}

export abstract class BaseCache implements CacheService {
    abstract get(key: string): Promise<unknown>;
    abstract set(key: string, value: string, ttl?: number): Promise<void>;
    abstract delete(key: string): Promise<void>;
    abstract getTTL(key: string): Promise<number | undefined>;

    async getString(key: string) {
        const value = await this.get(key);
        if (value == null) return undefined;
        if (typeof value !== "string") return String(value);
        return value;
    }

    async setString(key: string, value: string, ttl?: number) {
        return await this.set(key, String(value), ttl);
    }

    async getObject<T>(key: string): Promise<T | undefined> {
        const value = await this.getString(key);
        if (value == null) return undefined;
        try {
            return JSON.parse(value);
        } catch {
            return undefined;
        }
    }

    async setObject<T>(key: string, value: T, ttl?: number): Promise<void> {
        const jsonString = JSON.stringify(value);
        return await this.setString(key, jsonString, ttl);
    }

    async cachifyValidate<T extends z.ZodType>({
        fn,
        key,
        schema,
        ttlSeconds: ttl,
        validateCache,
    }: CachifyParams<T>): Promise<CachifyResponse<T>> {
        const cacheInfo = {
            cached: false,
            ttl,
        };
        let cachedValue: unknown;
        try {
            cachedValue = await this.getObject<unknown>(key);
            cacheInfo.ttl = await this.getTTL(key);
        } catch (error) {
            console.error(
                `Failed to retrieve from cache for key: ${key}`,
                error,
            );
            cachedValue = undefined;
        }
        if (cachedValue != null) {
            cacheInfo.cached = true;
            const result = schema.safeParse(cachedValue);
            if (result.success) {
                if (validateCache == null) {
                    return { data: result.data, info: cacheInfo };
                }

                if (validateCache(result.data)) {
                    return { data: result.data, info: cacheInfo };
                }
            }
        }
        const value = await fn();
        const result = schema.safeParse(value);
        if (!result.success) {
            throw new Error(
                `Invalid returned value from function: ${result.error.message}`,
            );
        }
        try {
            await this.setObject(key, result.data, ttl);
        } catch (error) {
            console.error(`Failed to cache value for key: ${key}`, error);
        }
        return { data: result.data, info: cacheInfo };
    }
}

export { RedisCache } from "./redis";
export { InMemoryCache } from "./in-memory";
