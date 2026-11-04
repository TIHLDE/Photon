import { isFeideCallback } from "@photon/auth/feide";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * The Feide sync and the post-revoke redirect both run from Better Auth's
 * `after` hook and act only when {@link isFeideCallback} says the request is
 * Feide's callback. Nothing else exercises that check — a real callback needs
 * Dataporten — so if Better Auth renames the route again, the hooks quietly
 * stop firing and every other test stays green. 1.7 did exactly that, moving
 * generic OAuth from `/oauth2/callback/:providerId` to `/callback/:id`.
 */
describe("Feide callback route", () => {
    integrationTest(
        "matches the route Better Auth actually serves the callback on",
        async ({ ctx }) => {
            const { path } = ctx.auth.api.callbackOAuth;

            expect(isFeideCallback({ path, params: { id: "feide" } })).toBe(
                true,
            );
        },
    );

    integrationTest("ignores other providers and other routes", async () => {
        expect(
            isFeideCallback({
                path: "/callback/:id",
                params: { id: "google" },
            }),
        ).toBe(false);
        expect(
            isFeideCallback({
                path: "/oauth2/callback/:providerId",
                params: { providerId: "feide" },
            }),
        ).toBe(false);
        expect(isFeideCallback({ path: "/callback/:id" })).toBe(false);
    });
});
