import { describe, expect, it } from "vitest";

import { sharedParentDomain } from "@photon/auth";

/**
 * The session cookie must be scoped to the parent domain shared by the
 * frontend and the API so that SSR on the frontend receives it and can
 * forward it. See `crossSubDomainCookies` in @photon/auth.
 */
describe("sharedParentDomain", () => {
    it("finds the parent when the API is a subdomain of the frontend", () => {
        expect(
            sharedParentDomain(
                "https://tihlde.org",
                "https://photon.tihlde.org",
            ),
        ).toBe("tihlde.org");
    });

    it("finds the parent when both are sibling subdomains", () => {
        expect(
            sharedParentDomain(
                "https://kvark.tihlde.org",
                "https://photon.tihlde.org",
            ),
        ).toBe("tihlde.org");
    });

    it("returns undefined for identical hosts (localhost dev)", () => {
        expect(
            sharedParentDomain(
                "http://localhost:3000",
                "http://localhost:4000",
            ),
        ).toBeUndefined();
    });

    it("returns undefined for unrelated hosts", () => {
        expect(
            sharedParentDomain(
                "https://kvark.vercel.app",
                "https://photon.tihlde.org",
            ),
        ).toBeUndefined();
    });

    it("never widens the cookie to a bare TLD", () => {
        expect(
            sharedParentDomain("https://tihlde.org", "https://ntnu.org"),
        ).toBeUndefined();
    });
});
