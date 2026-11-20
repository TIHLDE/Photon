import { parseEnv } from "@photon/core/env";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

const envOverrides = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock("@photon/core/env", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@photon/core/env")>();
    return {
        ...actual,
        env: new Proxy({} as Record<string, unknown>, {
            get: (_, prop: string) =>
                prop in envOverrides
                    ? envOverrides[prop]
                    : (actual.env as unknown as Record<string, unknown>)[prop],
        }),
    };
});

afterEach(() => {
    delete envOverrides.EMAIL_API_KEY;
});

function sendWith(ctx: IntegrationTestContext, token: string) {
    return ctx.utils
        .client({ Authorization: `Bearer ${token}` })
        .api.email.send.$post({
            json: {
                to: "test@example.com",
                subject: "Test",
                content: [{ type: "text", content: "Test" }],
            },
        });
}

describe("EMAIL_API_KEY", () => {
    it("parses as unset in production rather than as a known default", () => {
        const parsed = parseEnv({ NODE_ENV: "production" });
        expect(parsed.EMAIL_API_KEY).toBeUndefined();
    });

    integrationTest.for([
        ["unset", undefined],
        ["empty", ""],
    ] as const)(
        "the route answers 503 when the key is %s",
        async ([, value], { ctx }) => {
            envOverrides.EMAIL_API_KEY = value;
            const response = await sendWith(ctx, "test-email-api-key");
            expect(response.status).toBe(503);
        },
    );

    integrationTest("the right key is accepted", async ({ ctx }) => {
        const response = await sendWith(ctx, "test-email-api-key");
        expect(response.status).toBe(200);
    });

    integrationTest.for([
        ["of the same length", "test-email-api-kez"],
        ["that is shorter", "test"],
        ["that is longer", "test-email-api-key-and-then-some"],
    ] as const)("a wrong key %s is refused", async ([, token], { ctx }) => {
        const response = await sendWith(ctx, token);
        expect(response.status).toBe(403);
    });
});
