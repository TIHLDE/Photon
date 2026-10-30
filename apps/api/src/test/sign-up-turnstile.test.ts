import { createAuth, drizzleAdapter, runTrustedSignUp } from "@photon/auth";
import { env } from "@photon/core/env";
import { schema } from "@photon/db";
import { afterEach, describe, expect, vi } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

/**
 * Cloudflare Turnstile on the public sign-up.
 *
 * The suite's shared context runs without a secret key, so the check is off
 * everywhere else; these tests build an auth instance with one. Cloudflare is
 * never reached — `fetch` is stubbed with what siteverify would answer.
 */
describe("sign-up with Turnstile", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function authWithTurnstile(ctx: IntegrationTestContext) {
        return createAuth({
            isDevMode: true,
            secret: env.AUTH_SECRET,
            turnstile: {
                secretKey: "test-secret",
                hostnames: ["tihlde.org"],
            },
            services: {
                database: drizzleAdapter(ctx.db, { provider: "pg", schema }),
                db: ctx.db,
                cache: ctx.cache,
                email: ctx.email,
            },
            oauth: {
                pages: {
                    consent: `${env.WEBSITE_URL}/oauth/consent`,
                    login: `${env.WEBSITE_URL}/login`,
                },
            },
            urls: {
                backend: env.ROOT_URL,
                frontend: env.WEBSITE_URL,
                additionalTrusted: [env.ROOT_URL, ...env.WEBSITE_ORIGINS],
                basePath: "/api/auth",
            },
            DANGEROUSLY_SET_INSECURE_HASHING_ALGORITHM: true,
        });
    }

    /**
     * Answer Cloudflare's siteverify with `success`, for a token solved on
     * `hostname` by a widget rendered with `action`.
     */
    function stubSiteverify(
        success: boolean,
        { action = "signup", hostname = "tihlde.org" } = {},
    ) {
        const fetchMock = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        success,
                        action,
                        hostname,
                        "error-codes": success
                            ? []
                            : ["invalid-input-response"],
                    }),
                    { headers: { "Content-Type": "application/json" } },
                ),
        );
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    async function signUp(
        auth: ReturnType<typeof createAuth>,
        email: string,
        token?: string,
    ) {
        return await auth.handler(
            new Request(`${env.ROOT_URL}/api/auth/sign-up/email`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "x-captcha-response": token } : {}),
                },
                body: JSON.stringify({
                    name: "Kari Nordmann",
                    email,
                    password: "hemmeligpassord",
                }),
            }),
        );
    }

    async function userExists(ctx: IntegrationTestContext, email: string) {
        const row = await ctx.db.query.user.findFirst({
            where: { email },
            columns: { id: true },
        });
        return row !== undefined;
    }

    /**
     * The website and the API are different origins, so the browser asks
     * first whether it may send the token header at all.
     */
    integrationTest(
        "CORS lets the website send the token header",
        async ({ ctx }) => {
            const res = await ctx.app.request("/api/auth/sign-up/email", {
                method: "OPTIONS",
                headers: {
                    Origin: env.WEBSITE_ORIGINS[0]!,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers":
                        "content-type,x-captcha-response",
                },
            });

            const allowed = (
                res.headers.get("Access-Control-Allow-Headers") ?? ""
            ).toLowerCase();
            expect(allowed).toContain("x-captcha-response");
        },
    );

    integrationTest("refuses a sign-up without a token", async ({ ctx }) => {
        const fetchMock = stubSiteverify(true);

        const res = await signUp(authWithTurnstile(ctx), "bot@example.com");

        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(await userExists(ctx, "bot@example.com")).toBe(false);
    });

    integrationTest("refuses a token Cloudflare rejects", async ({ ctx }) => {
        stubSiteverify(false);

        const res = await signUp(
            authWithTurnstile(ctx),
            "bot@example.com",
            "forged-token",
        );

        expect(res.status).toBe(403);
        expect(await userExists(ctx, "bot@example.com")).toBe(false);
    });

    integrationTest(
        "refuses a token solved on another widget or site",
        async ({ ctx }) => {
            const auth = authWithTurnstile(ctx);

            stubSiteverify(true, { action: "login" });
            const otherAction = await signUp(auth, "bot@example.com", "t1");
            expect(otherAction.status).toBe(403);

            stubSiteverify(true, { hostname: "evil.example.com" });
            const otherHost = await signUp(auth, "bot@example.com", "t2");
            expect(otherHost.status).toBe(403);

            expect(await userExists(ctx, "bot@example.com")).toBe(false);
        },
    );

    integrationTest("accepts a solved challenge", async ({ ctx }) => {
        const fetchMock = stubSiteverify(true);

        const res = await signUp(
            authWithTurnstile(ctx),
            "kari.nordmann@gmail.com",
            "solved-token",
        );

        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(await userExists(ctx, "kari.nordmann@gmail.com")).toBe(true);
    });

    /**
     * Fadderuka creates accounts through `signUpEmail` on the server. There is
     * no browser on the other end to solve a challenge, and the API key has
     * already vouched for the request.
     */
    integrationTest(
        "a trusted server-side sign-up needs no token",
        async ({ ctx }) => {
            const fetchMock = stubSiteverify(false);
            const auth = authWithTurnstile(ctx);

            await runTrustedSignUp(undefined, () =>
                auth.api.signUpEmail({
                    body: {
                        name: "Ola Nordmann",
                        email: "olanor@stud.ntnu.no",
                        password: "hemmeligpassord",
                    },
                }),
            );

            expect(fetchMock).not.toHaveBeenCalled();
            expect(await userExists(ctx, "olanor@stud.ntnu.no")).toBe(true);
        },
    );
});
