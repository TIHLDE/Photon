import { describe, expect, it } from "vitest";

// A static import would pull kvark into this package's tsc rootDir.
const kvarkModule = new URL(
    "../../../kvark/src/lib/safe-redirect.ts",
    import.meta.url,
).pathname;
const { sanitizeRedirectTo }: { sanitizeRedirectTo: (url: unknown) => string } =
    await import(kvarkModule);

/**
 * Lives here because kvark has no test runner, and this suite is the one that
 * runs on every pull request that touches the API or shared code.
 */
describe("sanitizeRedirectTo", () => {
    it.each([
        "/",
        "/arrangementer",
        "/arrangementer/julebord?tab=info#pamelding",
        "/s%C3%B8k?q=a%5Cb",
    ])("keeps %s", (url) => {
        expect(sanitizeRedirectTo(url)).toBe(url);
    });

    it.each([
        "https://evil.example",
        "//evil.example",
        "evil.example",
        "/\\evil.example",
        "\\\\evil.example",
        "/foo\\bar",
        "/\t/evil.example",
        "/\n/evil.example",
        "/\r/evil.example",
        "/\u0000/evil.example",
        "/\u007f/evil.example",
        "/\u0085/evil.example",
    ])("rejects %j", (url) => {
        expect(sanitizeRedirectTo(url)).toBe("/");
    });

    it("rejects anything that is not a string", () => {
        expect(sanitizeRedirectTo(undefined)).toBe("/");
        expect(sanitizeRedirectTo(["/admin"])).toBe("/");
    });
});
