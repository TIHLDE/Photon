import { Hono } from "hono";
import { pino } from "pino";
import { describe, expect, test, vi } from "vitest";
import {
    clientIpFromChain,
    getClientInfo,
    parseUserAgent,
} from "~/lib/client-info";

const CHROME_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("clientIpFromChain", () => {
    test("behind one proxy, takes the entry nginx appended", () => {
        expect(clientIpFromChain("203.0.113.7", 1)).toBe("203.0.113.7");
    });

    test("ignores addresses the client put in the header itself", () => {
        expect(clientIpFromChain("1.1.1.1, 203.0.113.7", 1)).toBe(
            "203.0.113.7",
        );
    });

    test("counts back one entry per trusted proxy", () => {
        expect(clientIpFromChain("1.1.1.1, 203.0.113.7, 198.51.100.2", 2)).toBe(
            "203.0.113.7",
        );
    });

    test("falls back to the leftmost entry when the chain is short", () => {
        expect(clientIpFromChain("203.0.113.7", 2)).toBe("203.0.113.7");
    });

    test("trusts nothing without proxies or a header", () => {
        expect(clientIpFromChain("203.0.113.7", 0)).toBeUndefined();
        expect(clientIpFromChain(undefined, 1)).toBeUndefined();
        expect(clientIpFromChain(" , ", 1)).toBeUndefined();
    });
});

describe("parseUserAgent", () => {
    test("parses desktop and mobile browsers", () => {
        expect(parseUserAgent(CHROME_MAC)).toMatchObject({
            browser: "Chrome",
            os: "macOS",
            device: "desktop",
            isBot: false,
        });
        expect(parseUserAgent(SAFARI_IPHONE)).toMatchObject({
            browser: "Safari",
            os: "iOS",
            device: "mobile",
            isBot: false,
        });
    });

    test.each([
        "python-requests/2.31.0",
        "Python/3.12 aiohttp/3.9.1",
        "curl/8.4.0",
        "axios/1.7.2",
        "Go-http-client/1.1",
        "node",
        "Googlebot/2.1 (+http://www.google.com/bot.html)",
    ])("flags %s as a bot", (userAgent) => {
        const parsed = parseUserAgent(userAgent);
        expect(parsed.isBot).toBe(true);
        expect(parsed.botMatch).toBeTruthy();
    });

    test("handles a missing header", () => {
        expect(parseUserAgent(undefined)).toEqual({ isBot: false });
    });
});

describe("getClientInfo", () => {
    // What Bun passes to `fetch` as its second argument (Hono's `c.env`).
    const bunServer = {
        requestIP: () => ({ address: "10.0.0.5" }),
    };

    async function infoFor(
        headers: Record<string, string>,
        trustedProxies: number,
        env?: object,
    ) {
        const app = new Hono().get("/", (c) =>
            c.json(getClientInfo(c, trustedProxies)),
        );
        const response = await app.request("/", { headers }, env);
        return (await response.json()) as { ip?: string };
    }

    test("falls back to the socket address without X-Forwarded-For", async () => {
        expect((await infoFor({}, 1, bunServer)).ip).toBe("10.0.0.5");
    });

    test("uses the socket address when no proxy is trusted", async () => {
        const info = await infoFor(
            { "x-forwarded-for": "6.6.6.6" },
            0,
            bunServer,
        );
        expect(info.ip).toBe("10.0.0.5");
    });

    test("prefers X-Forwarded-For behind a trusted proxy", async () => {
        const info = await infoFor(
            { "x-forwarded-for": "203.0.113.7" },
            1,
            bunServer,
        );
        expect(info.ip).toBe("203.0.113.7");
    });

    test("detects a bot marker past the logged length", async () => {
        const userAgent = `${CHROME_MAC}${" ".repeat(600)} Googlebot/2.1`;
        const app = new Hono().get("/", (c) => c.json(getClientInfo(c, 1)));
        const response = await app.request("/", {
            headers: { "user-agent": userAgent },
        });
        const info = (await response.json()) as {
            userAgent?: string;
            ua: { isBot: boolean };
        };
        expect(info.ua.isBot).toBe(true);
        expect(info.userAgent).toHaveLength(512);
    });

    test("logs no IP when neither is available", async () => {
        expect((await infoFor({}, 1)).ip).toBeUndefined();
    });
});

describe("request logging", () => {
    async function logRequest(headers: Record<string, string>) {
        const records: Record<string, unknown>[] = [];
        const sink = pino(
            {},
            {
                write(line: string) {
                    records.push(JSON.parse(line));
                },
            },
        );
        vi.resetModules();
        vi.doMock("~/lib/logger", async (importOriginal) => ({
            ...(await importOriginal<typeof import("~/lib/logger")>()),
            logger: sink,
        }));
        const { pinoLoggerMiddleware } = await import("~/middleware/logger");
        vi.doUnmock("~/lib/logger");

        const app = new Hono()
            .use(pinoLoggerMiddleware)
            .get("/ping", (c) => c.text("pong"));
        await app.request("/ping", { headers });
        return records;
    }

    test("every request record carries the client, with the raw User-Agent for bots", async () => {
        const records = await logRequest({
            "x-forwarded-for": "6.6.6.6, 203.0.113.7",
            "user-agent": "python-requests/2.31.0",
        });

        expect(records).toHaveLength(2);
        for (const record of records) {
            expect(record.client).toEqual({
                ip: "203.0.113.7",
                userAgent: "python-requests/2.31.0",
                ua: {
                    isBot: true,
                    botMatch: "python-requests/2.31.0",
                },
            });
        }
    });

    test("browsers are logged with the parsed User-Agent only", async () => {
        const records = await logRequest({
            "x-forwarded-for": "203.0.113.7",
            "user-agent": CHROME_MAC,
        });

        expect(records).toHaveLength(2);
        for (const record of records) {
            expect(record.client).toEqual({
                ip: "203.0.113.7",
                ua: {
                    browser: "Chrome",
                    os: "macOS",
                    device: "desktop",
                    isBot: false,
                },
            });
        }
    });
});
