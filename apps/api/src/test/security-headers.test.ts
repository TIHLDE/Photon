import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * The website lives on another subdomain and embeds images and PDFs from this
 * host, so the headers that would stop that are asserted absent just as firmly
 * as the wanted ones are asserted present.
 */
describe("security headers on API responses", () => {
    const responses: [string, string, RequestInit?][] = [
        ["a normal response", "/api/version"],
        ["a not-found response", "/api/does-not-exist"],
        ["an auth handler response", "/api/auth/get-session"],
        ["a rejected request", "/api/user/me/settings"],
        [
            "a CORS preflight",
            "/api/version",
            {
                method: "OPTIONS",
                headers: {
                    Origin: "http://localhost:3000",
                    "Access-Control-Request-Method": "GET",
                },
            },
        ],
    ];

    integrationTest.for(responses)("%s", async ([, path, init], { ctx }) => {
        const res = await ctx.app.request(path, init);

        expect(res.headers.get("x-content-type-options")).toBe("nosniff");
        expect(res.headers.get("strict-transport-security")).toBe(
            "max-age=31536000",
        );
        expect(res.headers.get("cross-origin-resource-policy")).toBeNull();
        expect(res.headers.get("cross-origin-opener-policy")).toBeNull();
        expect(res.headers.get("x-frame-options")).toBeNull();
    });
});
