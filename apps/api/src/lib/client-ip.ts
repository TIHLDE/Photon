import { BlockList, isIP } from "node:net";
import type { Context } from "hono";
import { env } from "~/lib/env";
import type { LoggerType } from "~/middleware/logger";

const INTERNAL_ADDRESSES = new BlockList();
INTERNAL_ADDRESSES.addSubnet("0.0.0.0", 8, "ipv4");
INTERNAL_ADDRESSES.addSubnet("10.0.0.0", 8, "ipv4");
INTERNAL_ADDRESSES.addSubnet("100.64.0.0", 10, "ipv4");
INTERNAL_ADDRESSES.addSubnet("127.0.0.0", 8, "ipv4");
INTERNAL_ADDRESSES.addSubnet("169.254.0.0", 16, "ipv4");
INTERNAL_ADDRESSES.addSubnet("172.16.0.0", 12, "ipv4");
INTERNAL_ADDRESSES.addSubnet("192.168.0.0", 16, "ipv4");
INTERNAL_ADDRESSES.addAddress("::", "ipv6");
INTERNAL_ADDRESSES.addAddress("::1", "ipv6");
INTERNAL_ADDRESSES.addSubnet("fc00::", 7, "ipv6");
INTERNAL_ADDRESSES.addSubnet("fe80::", 10, "ipv6");

/**
 * Whether nginx appends to X-Forwarded-For or overwrites it, the address it saw
 * is the last entry, and everything before that is whatever the client sent, so
 * nothing further left is ever read. An internal last entry means nginx is not
 * what talks to the API, or sees a gateway: no client can be told apart there,
 * and treating that address as one would put everybody in the same bucket.
 */
export function clientIpFromForwardedFor(
    header: string | undefined,
): string | undefined {
    const lastHop = header?.split(",").at(-1)?.trim();
    if (!lastHop) return undefined;

    const version = isIP(lastHop);
    if (version === 0) return undefined;

    return INTERNAL_ADDRESSES.check(lastHop, version === 6 ? "ipv6" : "ipv4")
        ? undefined
        : lastHop;
}

export function clientIp(c: Context): string | undefined {
    const header = c.req.header("x-forwarded-for");
    const ip = clientIpFromForwardedFor(header);

    if (!ip && env.NODE_ENV === "production") {
        const logger: LoggerType = c.get("logger");
        logger.warn(
            { hasForwardedFor: header !== undefined },
            "No client address in X-Forwarded-For; check the proxy in front of the API",
        );
    }

    return ip;
}
