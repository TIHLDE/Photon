import type { CacheService } from "@photon/core/services/cache";
import type { LoggerType } from "~/middleware/logger";

export type UsageWindow = {
    name: string;
    limit: number;
    seconds: number;
};

/**
 * Count one use against a fixed time window. Returns false once the window is
 * full.
 *
 * An unreachable cache lets the request through: uploads and images do not
 * otherwise depend on Redis, and a limit must not be what takes them down.
 */
export async function takeFromWindow(
    cache: CacheService,
    { name, limit, seconds }: UsageWindow,
    logger?: LoggerType,
): Promise<boolean> {
    const windowStart = Math.floor(Date.now() / (seconds * 1000));
    const key = `${name}:${windowStart}`;

    try {
        const used = Number(await cache.getString(key)) || 0;
        if (used >= limit) {
            return false;
        }
        await cache.setString(key, String(used + 1), seconds);
    } catch (error) {
        logger?.warn({ err: error, key }, "Could not read usage window");
    }

    return true;
}
