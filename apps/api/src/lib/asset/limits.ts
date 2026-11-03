import type { CacheService } from "@photon/core/services/cache";
import type { LoggerType } from "~/middleware/logger";

export type UsageWindow = {
    name: string;
    limit: number;
    seconds: number;
};

/** Long enough for a healthy Redis, short enough that nobody notices it failing. */
const CACHE_TIMEOUT_MS = 500;

const pendingCounts = new Map<string, Promise<boolean>>();

/**
 * Count one use against a fixed time window. Returns false once the window is
 * full.
 *
 * Counts of the same window run one at a time, since the cache has no atomic
 * increment and parallel requests would otherwise all read the same number.
 *
 * A cache that errors or does not answer lets the request through: the Redis
 * client queues commands while disconnected, and uploads and images do not
 * otherwise depend on it.
 */
export function takeFromWindow(
    cache: CacheService,
    { name, limit, seconds }: UsageWindow,
    logger?: LoggerType,
): Promise<boolean> {
    const windowStart = Math.floor(Date.now() / (seconds * 1000));
    const key = `${name}:${windowStart}`;

    const count = async (): Promise<boolean> => {
        const used = Number(await cache.getString(key)) || 0;
        if (used >= limit) {
            return false;
        }
        await cache.setString(key, String(used + 1), seconds);
        return true;
    };

    const counted = (pendingCounts.get(key) ?? Promise.resolve(true)).then(
        count,
        count,
    );
    pendingCounts.set(key, counted);
    const forget = () => {
        if (pendingCounts.get(key) === counted) {
            pendingCounts.delete(key);
        }
    };
    void counted.then(forget, forget);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<boolean>((_, reject) => {
        timer = setTimeout(
            () => reject(new Error("Cache did not answer")),
            CACHE_TIMEOUT_MS,
        );
    });

    return Promise.race([counted, timeout])
        .catch((error: unknown) => {
            logger?.warn({ err: error, key }, "Could not count usage");
            return true;
        })
        .finally(() => clearTimeout(timer));
}
