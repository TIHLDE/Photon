import { env } from "@photon/core/env";
import Bowser from "bowser";
import type { Context } from "hono";
import { isbotMatch } from "isbot";

/** Long headers are almost always junk or abuse; don't let them bloat Loki. */
const MAX_HEADER_LENGTH = 512;
/** Names and matches parsed out of the header; real ones are far shorter. */
const MAX_PARSED_LENGTH = 128;

/**
 * The values bowser puts in `platform.type` (its `PLATFORMS_MAP`). Its types
 * only say `string`, so the union lives here.
 */
const DEVICE_TYPES = ["desktop", "mobile", "tablet", "tv", "bot"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

function toDeviceType(value: string | undefined): DeviceType | undefined {
    return DEVICE_TYPES.find((type) => type === value);
}

export type ClientInfo = {
    /** Best guess at the client's address; see {@link clientIpFromChain}. */
    ip?: string;
    /** The raw User-Agent, only for bots; the parsed fields cover the rest. */
    userAgent?: string;
    ua: {
        browser?: string;
        os?: string;
        device?: DeviceType;
        /**
         * True for crawlers and for HTTP libraries and runtimes (curl,
         * python-requests, aiohttp, axios, Go-http-client, node, Bun, …).
         */
        isBot: boolean;
        /** The part of the User-Agent that made isbot match, e.g. "python-requests/2.31.0". */
        botMatch?: string;
    };
};

function truncate(
    value: string | undefined,
    maxLength: number = MAX_HEADER_LENGTH,
): string | undefined {
    if (!value) return undefined;
    return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * Pick the client address out of an X-Forwarded-For chain.
 *
 * Every proxy appends the address it received the request from, so the
 * entries a client sends itself end up on the left. Only the last
 * `trustedProxies` entries were written by proxies we run; the leftmost of
 * those is the client. Reading the first entry instead would let anyone choose
 * their own logged IP by sending the header.
 */
export function clientIpFromChain(
    forwardedFor: string | undefined,
    trustedProxies: number,
): string | undefined {
    if (!forwardedFor || trustedProxies < 1) return undefined;
    const entries = forwardedFor
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (entries.length === 0) return undefined;
    // Fewer entries than proxies means a hop didn't append; the leftmost is
    // still the best guess.
    return entries[Math.max(0, entries.length - trustedProxies)];
}

/**
 * The TCP peer — nginx in production, the client itself in local dev.
 *
 * Bun passes its server as the second `fetch` argument, which Hono exposes as
 * `c.env`. Not `getConnInfo` from "hono/bun": that module touches the `Bun`
 * global on import, which breaks the tests running under Node.
 */
function socketAddress(c: Context): string | undefined {
    const server = c.env as
        | { requestIP?: (request: Request) => { address: string } | null }
        | undefined;
    try {
        return server?.requestIP?.(c.req.raw)?.address;
    } catch {
        return undefined;
    }
}

export function parseUserAgent(
    userAgent: string | undefined,
): ClientInfo["ua"] {
    if (!userAgent) return { isBot: false };

    const match = isbotMatch(userAgent);
    let parsed: Bowser.Parser.ParsedResult | undefined;
    try {
        parsed = Bowser.parse(userAgent);
    } catch {
        // A malformed header must never break request logging.
    }

    return {
        // These are copied out of the header, so they are as long as the
        // client makes them.
        browser: truncate(parsed?.browser.name, MAX_PARSED_LENGTH),
        os: truncate(parsed?.os.name, MAX_PARSED_LENGTH),
        device: toDeviceType(parsed?.platform.type),
        isBot: match !== null,
        botMatch: truncate(match ?? undefined, MAX_PARSED_LENGTH),
    };
}

export function getClientInfo(
    c: Context,
    trustedProxies: number = env.TRUSTED_PROXY_COUNT,
): ClientInfo {
    const forwardedFor = c.req.header("x-forwarded-for");
    // Classify the whole header and only shorten what gets logged: a bot
    // marker past the cut would otherwise go unnoticed.
    const userAgent = c.req.header("user-agent");
    const ua = parseUserAgent(userAgent);

    return {
        ip: clientIpFromChain(forwardedFor, trustedProxies) ?? socketAddress(c),
        ...(ua.isBot ? { userAgent: truncate(userAgent) } : {}),
        ua,
    };
}
