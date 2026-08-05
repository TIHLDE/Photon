import { describe, expect, it } from "vitest";

import { parseEnv } from "@photon/core/env";

/**
 * WEBSITE_ORIGINS is the set of frontend origins the API accepts, both for
 * CORS (see app.ts) and Better Auth's trustedOrigins (see lib/ctx.ts).
 *
 * It exists because the website moves from new.tihlde.org to tihlde.org while
 * WEBSITE_URL is set in Drift's environment, not this repo: the Vercel domain
 * move and that variable cannot change in the same instant. Production must
 * therefore accept both ends of the cutover.
 */
describe("WEBSITE_ORIGINS", () => {
    it("accepts both sides of the tihlde.org cutover in production", () => {
        const env = parseEnv({
            NODE_ENV: "production",
            WEBSITE_URL: "https://new.tihlde.org",
        });

        expect(env.WEBSITE_ORIGINS).toContain("https://new.tihlde.org");
        expect(env.WEBSITE_ORIGINS).toContain("https://tihlde.org");
        expect(env.WEBSITE_ORIGINS).toContain("https://www.tihlde.org");
    });

    it("still accepts the cutover set once WEBSITE_URL has moved over", () => {
        const env = parseEnv({
            NODE_ENV: "production",
            WEBSITE_URL: "https://tihlde.org",
        });

        expect(env.WEBSITE_ORIGINS).toContain("https://tihlde.org");
        expect(env.WEBSITE_ORIGINS).toContain("https://new.tihlde.org");
    });

    it("lists WEBSITE_URL first, since links are built from it", () => {
        const env = parseEnv({
            NODE_ENV: "production",
            WEBSITE_URL: "https://new.tihlde.org",
        });

        expect(env.WEBSITE_ORIGINS[0]).toBe("https://new.tihlde.org");
    });

    it("drops a trailing slash so it can match an Origin header", () => {
        const env = parseEnv({
            NODE_ENV: "production",
            WEBSITE_URL: "https://tihlde.org/",
        });

        expect(env.WEBSITE_ORIGINS).toContain("https://tihlde.org");
        expect(env.WEBSITE_ORIGINS).not.toContain("https://tihlde.org/");
    });

    it("does not widen dev beyond WEBSITE_URL", () => {
        const env = parseEnv({
            NODE_ENV: "development",
            WEBSITE_URL: "http://localhost:3000",
        });

        expect(env.WEBSITE_ORIGINS).toEqual(["http://localhost:3000"]);
    });

    it("lets an explicit list override the production default", () => {
        const env = parseEnv({
            NODE_ENV: "production",
            WEBSITE_URL: "https://tihlde.org",
            EXTRA_WEBSITE_ORIGINS:
                "https://beta.tihlde.org, https://tihlde.org",
        });

        expect(env.WEBSITE_ORIGINS).toEqual([
            "https://tihlde.org",
            "https://beta.tihlde.org",
        ]);
    });
});
