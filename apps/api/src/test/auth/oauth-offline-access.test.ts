import { Buffer } from "node:buffer";
import { env } from "@photon/core/env";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

/**
 * `offline_access` must survive the whole way from the discovery document to a
 * refresh token.
 *
 * #644: the document advertised the scope while `/oauth2/authorize` rejected
 * it, and the rejection took the entire login with it — `invalid_scope` is
 * returned before the user ever sees a consent screen, so a client that
 * believed the document could not log anyone in at all. What made them
 * disagree was the client row's own `scopes` column, which overrides the
 * provider list whenever it holds anything; the clients affected were created
 * before `offline_access` existed in that list and there is no UI to widen
 * them again.
 *
 * These tests pin both halves: that the advertised list is the list authorize
 * accepts, and that a client created the way the admin panel creates one — no
 * `scope` in the body, so nothing stored on the row — can actually obtain a
 * refresh token.
 */

const redirectUri = "http://127.0.0.1:3000/oauth/callback";
const authBaseUrl = `${env.ROOT_URL}/api/auth`;

type OAuthClient = { client_id: string };

type TokenResponse = {
    access_token: string;
    refresh_token?: string;
    token_type: "Bearer";
    expires_in: number;
    scope: string;
};

async function signInAndGetCookie(
    ctx: IntegrationTestContext,
    user: { email: string; password: string },
) {
    const response = await ctx.auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        returnHeaders: true,
    });

    const cookie = response.headers.getSetCookie()[0]?.split(";")[0];
    if (!cookie) throw new Error("Invalid cookies returned by auth call");
    return cookie;
}

/**
 * Deliberately sends no `scope`: this is what `/admin/oauth-clients` posts, and
 * the resulting row inherits the provider list rather than freezing a copy of
 * it.
 */
async function createOAuthClient(ctx: IntegrationTestContext, cookie: string) {
    return (await ctx.auth.api.adminCreateOAuthClient({
        headers: new Headers({ Cookie: cookie }),
        body: {
            client_name: "offline_access integration test",
            redirect_uris: [redirectUri],
            token_endpoint_auth_method: "none",
            type: "native",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
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

async function authorize(
    ctx: IntegrationTestContext,
    options: { cookie: string; clientId: string; scope: string },
) {
    const pkce = await createPkcePair();
    const authorizeUrl = new URL(`${authBaseUrl}/oauth2/authorize`);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", options.clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", options.scope);
    authorizeUrl.searchParams.set("state", crypto.randomUUID());
    authorizeUrl.searchParams.set("code_challenge", pkce.challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    const response = await ctx.app.request(authorizeUrl.toString(), {
        headers: { Cookie: options.cookie },
    });
    const location = new URL(
        response.headers.get("Location") ?? redirectUri,
        redirectUri,
    );

    return {
        status: response.status,
        code: location.searchParams.get("code"),
        error: location.searchParams.get("error"),
        errorDescription: location.searchParams.get("error_description"),
        verifier: pkce.verifier,
    };
}

async function exchange(
    ctx: IntegrationTestContext,
    body: Record<string, string>,
) {
    const response = await ctx.app.request(`${authBaseUrl}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body),
    });

    return {
        status: response.status,
        token: (await response.json()) as TokenResponse,
    };
}

describe("OAuth offline_access", () => {
    integrationTest(
        "issues a refresh token to a client that stores no scopes of its own",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const cookie = await signInAndGetCookie(ctx, user);
            const client = await createOAuthClient(ctx, cookie);

            const authorized = await authorize(ctx, {
                cookie,
                clientId: client.client_id,
                scope: "openid profile email offline_access",
            });

            expect(authorized.error).toBeNull();
            expect(authorized.status).toBe(302);
            expect(authorized.code).toBeTruthy();

            const issued = await exchange(ctx, {
                grant_type: "authorization_code",
                client_id: client.client_id,
                redirect_uri: redirectUri,
                code: authorized.code ?? "",
                code_verifier: authorized.verifier,
                resource: authBaseUrl,
            });

            expect(issued.status).toBe(200);
            expect(issued.token.scope.split(" ")).toContain("offline_access");
            expect(issued.token.refresh_token).toBeTruthy();

            // The point of the scope: a token that outlives the first hour.
            const renewed = await exchange(ctx, {
                grant_type: "refresh_token",
                client_id: client.client_id,
                refresh_token: issued.token.refresh_token ?? "",
                resource: authBaseUrl,
            });

            expect(renewed.status).toBe(200);
            expect(renewed.token.access_token).toBeTruthy();
        },
        500_000,
    );

    integrationTest(
        "accepts every scope the discovery document advertises",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const cookie = await signInAndGetCookie(ctx, user);
            const client = await createOAuthClient(ctx, cookie);

            const discovery = await ctx.app.request(
                `${authBaseUrl}/.well-known/openid-configuration`,
            );
            expect(discovery.status).toBe(200);

            const { scopes_supported: advertised } =
                (await discovery.json()) as { scopes_supported: string[] };
            expect(advertised).toContain("offline_access");

            const authorized = await authorize(ctx, {
                cookie,
                clientId: client.client_id,
                scope: advertised.join(" "),
            });

            expect(authorized.errorDescription).toBeNull();
            expect(authorized.error).toBeNull();
            expect(authorized.code).toBeTruthy();
        },
        500_000,
    );
});
