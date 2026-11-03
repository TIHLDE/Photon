import { Buffer } from "node:buffer";
import { env } from "@photon/core/env";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

const authBaseUrl = `${env.ROOT_URL}/api/auth`;
const redirectUri = "http://127.0.0.1:3000/oauth/callback";

type Credentials = { email: string; password: string };

/**
 * Every cookie sign-in sets. The shared `clientForUser` keeps only the first,
 * which is what kept the five-minute cookie cache out of every earlier test.
 */
async function signIn(ctx: IntegrationTestContext, user: Credentials) {
    const res = await ctx.auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        returnHeaders: true,
    });
    return res.headers.getSetCookie().map((c) => c.split(";")[0] as string);
}

const sessionTokenOnly = (cookies: string[]) =>
    cookies.filter((c) => c.split("=")[0]?.endsWith(".session_token"));

async function isSignedIn(ctx: IntegrationTestContext, cookies: string[]) {
    const headers = { Cookie: cookies.join("; ") };
    const [session, me] = await Promise.all([
        ctx.app.request(`${authBaseUrl}/get-session`, { headers }),
        ctx.app.request(`${env.ROOT_URL}/api/user/me/settings`, { headers }),
    ]);
    const active = (await session.json()) !== null;
    expect(me.status !== 401).toBe(active);
    return active;
}

const deactivate = async (
    ctx: IntegrationTestContext,
    targetId: string,
    isActive = false,
) => {
    const admin = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
    const client = await ctx.utils.clientForUser(admin);
    const res = await client.api.user[":id"].status.$patch({
        param: { id: targetId },
        json: { isActive },
    });
    expect(res.status).toBe(200);
};

const deleteUser = async (ctx: IntegrationTestContext, targetId: string) => {
    const admin = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(admin, ["users:delete"]);
    const client = await ctx.utils.clientForUser(admin);
    const res = await client.api.user[":id"].$delete({
        param: { id: targetId },
    });
    expect(res.status).toBe(204);
};

async function pkcePair() {
    const verifier = Buffer.from(
        crypto.getRandomValues(new Uint8Array(32)),
    ).toString("base64url");
    const challenge = Buffer.from(
        await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(verifier),
        ),
    ).toString("base64url");
    return { verifier, challenge };
}

const tokenRequest = (
    ctx: IntegrationTestContext,
    body: Record<string, string>,
) =>
    ctx.app.request(`${authBaseUrl}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body),
    });

/** A client holding a refresh token for `user`, as an app in production would. */
async function oauthGrantFor(ctx: IntegrationTestContext, user: Credentials) {
    const owner = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(owner, ["oauth-clients:create"]);
    const ownerCookies = await signIn(ctx, owner);
    const { client_id: clientId } = (await ctx.auth.api.adminCreateOAuthClient({
        headers: new Headers({ Cookie: ownerCookies.join("; ") }),
        body: {
            client_name: "session revocation test",
            redirect_uris: [redirectUri],
            token_endpoint_auth_method: "none",
            type: "native",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            skip_consent: true,
            require_pkce: true,
        },
    })) as { client_id: string };

    const pkce = await pkcePair();
    const authorize = new URL(`${authBaseUrl}/oauth2/authorize`);
    for (const [key, value] of Object.entries({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "openid profile email offline_access",
        state: crypto.randomUUID(),
        code_challenge: pkce.challenge,
        code_challenge_method: "S256",
    })) {
        authorize.searchParams.set(key, value);
    }
    const cookies = await signIn(ctx, user);
    const redirect = await ctx.app.request(authorize.toString(), {
        headers: { Cookie: cookies.join("; ") },
    });
    const code = new URL(
        redirect.headers.get("Location") ?? redirectUri,
        redirectUri,
    ).searchParams.get("code");

    const issued = await tokenRequest(ctx, {
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirectUri,
        code: code ?? "",
        code_verifier: pkce.verifier,
        resource: authBaseUrl,
    });
    expect(issued.status).toBe(200);
    const { refresh_token: refreshToken } = (await issued.json()) as {
        refresh_token: string;
    };
    return { clientId, refreshToken };
}

describe("deactivating a member", () => {
    integrationTest(
        "ends a session whose cookies include the cookie cache",
        async ({ ctx }) => {
            const target = await ctx.utils.createTestUser();
            const cookies = await signIn(ctx, target);
            expect(await isSignedIn(ctx, cookies)).toBe(true);

            await deactivate(ctx, target.id);

            expect(await isSignedIn(ctx, cookies)).toBe(false);
        },
    );

    integrationTest(
        "ends a session still held in secondary storage",
        async ({ ctx }) => {
            const target = await ctx.utils.createTestUser();
            const cookies = sessionTokenOnly(await signIn(ctx, target));
            expect(await isSignedIn(ctx, cookies)).toBe(true);

            await deactivate(ctx, target.id);

            expect(await isSignedIn(ctx, cookies)).toBe(false);
        },
    );

    integrationTest(
        "ends a session whose entry in the active-session list is gone",
        async ({ ctx }) => {
            const target = await ctx.utils.createTestUser();
            const cookies = sessionTokenOnly(await signIn(ctx, target));
            await ctx.cache.delete(`active-sessions-${target.id}`);

            await deactivate(ctx, target.id);

            expect(await isSignedIn(ctx, cookies)).toBe(false);
        },
    );

    integrationTest(
        "stops an OAuth client from renewing its access",
        async ({ ctx }) => {
            const target = await ctx.utils.createTestUser();
            const { clientId, refreshToken } = await oauthGrantFor(ctx, target);

            await deactivate(ctx, target.id);

            const renewed = await tokenRequest(ctx, {
                grant_type: "refresh_token",
                client_id: clientId,
                refresh_token: refreshToken,
                resource: authBaseUrl,
            });
            expect(renewed.status).toBe(400);

            const accessTokens = await ctx.db
                .select()
                .from(schema.oauthAccessToken)
                .where(eq(schema.oauthAccessToken.userId, target.id));
            expect(accessTokens).toHaveLength(0);
        },
    );

    integrationTest("leaves other members signed in", async ({ ctx }) => {
        const target = await ctx.utils.createTestUser();
        const bystander = await ctx.utils.createTestUser();
        const cookies = await signIn(ctx, bystander);

        await deactivate(ctx, target.id);

        expect(await isSignedIn(ctx, cookies)).toBe(true);
    });

    integrationTest("reactivating lets them sign in again", async ({ ctx }) => {
        const target = await ctx.utils.createTestUser();
        await deactivate(ctx, target.id);
        await expect(signIn(ctx, target)).rejects.toThrow();

        await deactivate(ctx, target.id, true);

        expect(await isSignedIn(ctx, await signIn(ctx, target))).toBe(true);
    });
});

describe("deleting a member", () => {
    integrationTest("ends their sessions", async ({ ctx }) => {
        const target = await ctx.utils.createTestUser();
        const cookies = await signIn(ctx, target);
        const tokenOnly = sessionTokenOnly(cookies);
        expect(await isSignedIn(ctx, cookies)).toBe(true);

        await deleteUser(ctx, target.id);

        expect(await isSignedIn(ctx, cookies)).toBe(false);
        expect(await isSignedIn(ctx, tokenOnly)).toBe(false);
    });
});

describe("resetting a password", () => {
    integrationTest("ends every session on the account", async ({ ctx }) => {
        const target = await ctx.utils.createTestUser();
        const cookies = await signIn(ctx, target);
        const tokenOnly = sessionTokenOnly(cookies);
        expect(await isSignedIn(ctx, cookies)).toBe(true);

        const sendReset = vi.spyOn(ctx.email, "sendPasswordResetMail");
        await ctx.auth.api.requestPasswordReset({
            body: { email: target.email, redirectTo: "/reset-password" },
        });
        const url = new URL(sendReset.mock.calls[0]?.[0].url ?? "");
        const token = url.pathname.split("/").at(-1) ?? "";

        await ctx.auth.api.resetPassword({
            body: { newPassword: "et-nytt-passord-123", token },
        });

        expect(await isSignedIn(ctx, cookies)).toBe(false);
        expect(await isSignedIn(ctx, tokenOnly)).toBe(false);

        const fresh = await signIn(ctx, {
            email: target.email,
            password: "et-nytt-passord-123",
        });
        expect(await isSignedIn(ctx, fresh)).toBe(true);
    });
});
