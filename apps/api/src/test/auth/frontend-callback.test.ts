import { withFrontendCallback } from "@photon/auth";
import { describe, expect, it } from "vitest";

const FRONTEND = "https://tihlde.org";

describe("withFrontendCallback", () => {
    it("rewrites the default relative callbackURL to the frontend", () => {
        const url =
            "https://photon.tihlde.org/api/auth/verify-email?token=abc&callbackURL=%2F";
        const result = new URL(withFrontendCallback(url, FRONTEND));
        expect(result.searchParams.get("callbackURL")).toBe(
            "https://tihlde.org/",
        );
        // The action link itself still points at the backend (it must —
        // that's where the token is verified)
        expect(result.origin).toBe("https://photon.tihlde.org");
        expect(result.searchParams.get("token")).toBe("abc");
    });

    it("rewrites relative paths against the frontend, keeping the path", () => {
        const url =
            "https://photon.tihlde.org/api/auth/verify-email?token=abc&callbackURL=%2Fprofil";
        const result = new URL(withFrontendCallback(url, FRONTEND));
        expect(result.searchParams.get("callbackURL")).toBe(
            "https://tihlde.org/profil",
        );
    });

    it("adds a frontend callbackURL when none is present", () => {
        const url = "https://photon.tihlde.org/api/auth/verify-email?token=abc";
        const result = new URL(withFrontendCallback(url, FRONTEND));
        expect(result.searchParams.get("callbackURL")).toBe(
            "https://tihlde.org/",
        );
    });

    it("leaves absolute callback URLs untouched", () => {
        const url =
            "https://photon.tihlde.org/api/auth/reset-password/tok123?callbackURL=https%3A%2F%2Ftihlde.org%2Freset-password";
        const result = new URL(withFrontendCallback(url, FRONTEND));
        expect(result.searchParams.get("callbackURL")).toBe(
            "https://tihlde.org/reset-password",
        );
        expect(result.pathname).toBe("/api/auth/reset-password/tok123");
    });

    it("returns invalid URLs unchanged", () => {
        expect(withFrontendCallback("not-a-url", FRONTEND)).toBe("not-a-url");
    });
});
