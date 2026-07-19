import { Buffer } from "node:buffer";
import type { AuthSession, AuthUser } from "@photon/auth";
import { env } from "@photon/core/env";
import { Hono } from "hono";
import { describe, expect } from "vitest";
import type { AppContext } from "~/lib/ctx";
import { requireAuth } from "~/middleware/auth";
import { type LoggerType, pinoLoggerMiddleware } from "~/middleware/logger";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

type OAuthClient = {
    client_id: string;
};

type TokenResponse = {
    access_token: string;
    token_type: "Bearer";
    expires_in: number;
    scope: string;
};

type ProtectedVariables = {
    ctx: AppContext;
    logger: LoggerType;
    user: AuthUser;
    session?: AuthSession;
    oauthClient?: { clientId: string; scopes: string[] };
};

type ProtectedState = {
    user: AuthUser;
    session: AuthSession | null;
    oauthClient: { clientId: string; scopes: string[] } | null;
};

const redirectUri = "http://127.0.0.1:3000/oauth/callback";
const scopes = "openid profile email";

function createRequireAuthHarness(ctx: IntegrationTestContext) {
    return new Hono<{ Variables: ProtectedVariables }>()
        .use(pinoLoggerMiddleware)
        .use("*", async (c, next) => {
            c.set("ctx", ctx);
            await next();
        })
        .get("/protected", requireAuth, (c) => {
            return c.json({
                user: c.get("user"),
                session: c.get("session") ?? null,
                oauthClient: c.get("oauthClient") ?? null,
            });
        });
}

async function signInAndGetCookie(
    ctx: IntegrationTestContext,
    user: {
        email: string;
        password: string;
    },
) {
    const response = await ctx.auth.api.signInEmail({
        body: {
            email: user.email,
            password: user.password,
        },
        returnHeaders: true,
    });

    const cookie = response.headers.getSetCookie()[0]?.split(";")[0];
    if (!cookie) throw new Error("Invalid cookies returned by auth call");
    return cookie;
}

async function createOAuthClient(ctx: IntegrationTestContext, cookie: string) {
    return (await ctx.auth.api.adminCreateOAuthClient({
        headers: new Headers({ Cookie: cookie }),
        body: {
            client_name: "requireAuth integration test",
            redirect_uris: [redirectUri],
            token_endpoint_auth_method: "none",
            type: "native",
            grant_types: ["authorization_code"],
            response_types: ["code"],
            scope: scopes,
            skip_consent: true,
            require_pkce: true,
        },
    })) as OAuthClient;
}

function base64Url(bytes: ArrayBuffer | Uint8Array) {
    return Buffer.from(
        bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
    ).toString("base64url");
}

async function createPkcePair() {
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = base64Url(
        await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(verifier),
        ),
    );

    return { verifier, challenge };
}

async function issueOAuthAccessToken(
    ctx: IntegrationTestContext,
    options: {
        cookie: string;
        clientId: string;
    },
) {
    const authBaseUrl = `${env.ROOT_URL}/api/auth`;
    const pkce = await createPkcePair();
    const authorizeUrl = new URL(`${authBaseUrl}/oauth2/authorize`);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", options.clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", scopes);
    authorizeUrl.searchParams.set("state", crypto.randomUUID());
    authorizeUrl.searchParams.set("code_challenge", pkce.challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    const authorizeResponse = await ctx.app.request(authorizeUrl.toString(), {
        headers: { Cookie: options.cookie },
    });
    expect(authorizeResponse.status).toBe(302);

    const location = authorizeResponse.headers.get("Location");
    expect(location).toBeTruthy();

    const code = new URL(location ?? redirectUri).searchParams.get("code");
    expect(code).toBeTruthy();

    const tokenResponse = await ctx.app.request(`${authBaseUrl}/oauth2/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: options.clientId,
            redirect_uri: redirectUri,
            code: code ?? "",
            code_verifier: pkce.verifier,
            resource: authBaseUrl,
        }),
    });
    expect(tokenResponse.status).toBe(200);

    const token = (await tokenResponse.json()) as TokenResponse;
    expect(token.token_type).toBe("Bearer");
    expect(token.access_token.split(".")).toHaveLength(3);
    return token.access_token;
}

async function getProtectedState(
    app: ReturnType<typeof createRequireAuthHarness>,
    headers: Record<string, string>,
) {
    const response = await app.request("/protected", { headers });
    const isJson =
        response.headers.get("Content-Type")?.includes("application/json") ===
        true;
    return {
        response,
        body: isJson ? ((await response.json()) as ProtectedState) : undefined,
    };
}

describe("requireAuth OAuth access tokens", () => {
    integrationTest(
        "hydrates the same user and session from an OAuth JWT as cookie auth",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const cookie = await signInAndGetCookie(ctx, user);
            const oauthClient = await createOAuthClient(ctx, cookie);
            const accessToken = await issueOAuthAccessToken(ctx, {
                cookie,
                clientId: oauthClient.client_id,
            });
            const app = createRequireAuthHarness(ctx);

            const cookieAuth = await getProtectedState(app, { Cookie: cookie });
            const oauthAuth = await getProtectedState(app, {
                Authorization: `Bearer ${accessToken}`,
            });

            expect(cookieAuth.response.status).toBe(200);
            expect(oauthAuth.response.status).toBe(200);
            expect(oauthAuth.body?.user).toEqual(cookieAuth.body?.user);
            expect(oauthAuth.body?.session).toEqual(cookieAuth.body?.session);
            expect(oauthAuth.body?.oauthClient).toEqual({
                clientId: oauthClient.client_id,
                scopes: scopes.split(" "),
            });
        },
        500_000,
    );

    integrationTest(
        "prefers a valid OAuth bearer token over a different cookie session",
        async ({ ctx }) => {
            const oauthUser = await ctx.utils.createTestUser();
            const cookieUser = await ctx.utils.createTestUser();
            const oauthCookie = await signInAndGetCookie(ctx, oauthUser);
            const fallbackCookie = await signInAndGetCookie(ctx, cookieUser);
            const oauthClient = await createOAuthClient(ctx, oauthCookie);
            const accessToken = await issueOAuthAccessToken(ctx, {
                cookie: oauthCookie,
                clientId: oauthClient.client_id,
            });
            const app = createRequireAuthHarness(ctx);

            const response = await getProtectedState(app, {
                Authorization: `Bearer ${accessToken}`,
                Cookie: fallbackCookie,
            });

            expect(response.response.status).toBe(200);
            expect(response.body?.user.id).toBe(oauthUser.id);
            expect(response.body?.user.id).not.toBe(cookieUser.id);
            expect(response.body?.session?.userId).toBe(oauthUser.id);
            expect(response.body?.oauthClient?.clientId).toBe(
                oauthClient.client_id,
            );
        },
        500_000,
    );

    integrationTest(
        "falls back to cookie auth when a Bearer token cannot be verified",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const cookie = await signInAndGetCookie(ctx, user);
            const app = createRequireAuthHarness(ctx);

            const cookieAuth = await getProtectedState(app, { Cookie: cookie });
            const response = await getProtectedState(app, {
                Authorization: "Bearer not-a-valid-jwt",
                Cookie: cookie,
            });

            expect(response.response.status).toBe(200);
            expect(response.body?.user).toEqual(cookieAuth.body?.user);
            expect(response.body?.session).toEqual(cookieAuth.body?.session);
            expect(response.body?.oauthClient).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "ignores non-Bearer authorization headers and uses cookie auth",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const cookie = await signInAndGetCookie(ctx, user);
            const app = createRequireAuthHarness(ctx);

            const response = await getProtectedState(app, {
                Authorization: "Basic invalid",
                Cookie: cookie,
            });

            expect(response.response.status).toBe(200);
            expect(response.body?.user.id).toBe(user.id);
            expect(response.body?.session?.userId).toBe(user.id);
            expect(response.body?.oauthClient).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "returns 401 when neither bearer nor cookie auth succeeds",
        async ({ ctx }) => {
            const app = createRequireAuthHarness(ctx);

            const invalidBearer = await getProtectedState(app, {
                Authorization: "Bearer not-a-valid-jwt",
            });
            const missingAuth = await getProtectedState(app, {});

            expect(invalidBearer.response.status).toBe(401);
            expect(missingAuth.response.status).toBe(401);
        },
        500_000,
    );
});
