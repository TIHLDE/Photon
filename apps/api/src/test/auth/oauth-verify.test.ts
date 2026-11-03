import type { AuthInstance } from "@photon/auth";
import { verifyJWTAccessToken } from "@photon/auth/oauth-verify";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { JWTPayload } from "jose";
import { beforeAll, describe, expect, test } from "vitest";

/**
 * `verifyJWTAccessToken` is what turns a bearer token into a signed-in member,
 * so a token it accepts is a login. Every token here is signed with the key
 * the verifier trusts — the signature is never the thing being tested. What is
 * tested is everything else a genuine token from us can still get wrong:
 * the wrong issuer, the wrong audience, no expiry, or the wrong purpose (an ID
 * token, which carries the same `sub`/`sid` pair).
 */

const backend = "http://localhost:4000";
const frontend = "http://localhost:3000";
const authBase = `${backend}/api/auth`;

let privateKey: CryptoKey;
let auth: AuthInstance;

beforeAll(async () => {
    const pair = await generateKeyPair("EdDSA", { extractable: true });
    privateKey = pair.privateKey;
    const publicJwk = { ...(await exportJWK(pair.publicKey)), kid: "test" };

    // Only the two things the verifier reads: the JWKS and the base URL
    // configuration it derives issuer and audience from.
    auth = {
        options: {
            baseURL: {
                allowedHosts: [frontend, backend, "*localhost*"],
                protocol: "http",
                fallback: backend,
            },
            basePath: "/api/auth",
        },
        api: { getJwks: async () => ({ keys: [publicJwk] }) },
    } as unknown as AuthInstance;
});

const now = () => Math.floor(Date.now() / 1000);

/** The shape `/oauth2/token` issues when the client asks for our resource. */
function accessTokenClaims(): JWTPayload {
    return {
        sub: "user-1",
        sid: "session-1",
        azp: "client-1",
        scope: "openid profile email",
        aud: [authBase, `${authBase}/oauth2/userinfo`],
        iss: authBase,
        iat: now(),
        exp: now() + 3600,
    };
}

function sign(payload: JWTPayload): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: "EdDSA", kid: "test" })
        .sign(privateKey);
}

function without(payload: JWTPayload, key: string): JWTPayload {
    const { [key]: _omitted, ...rest } = payload;
    return rest;
}

describe("verifyJWTAccessToken", () => {
    test("accepts an access token for our API", async () => {
        const verified = await verifyJWTAccessToken(
            auth,
            await sign(accessTokenClaims()),
        );

        expect(verified).toMatchObject({
            sub: "user-1",
            sessionId: "session-1",
            clientId: "client-1",
            scopes: ["openid", "profile", "email"],
        });
    });

    test("accepts a token issued through the frontend host", async () => {
        // baseURL is resolved per request, so a token minted through the
        // website's proxy names the website as issuer and audience.
        const frontendBase = `${frontend}/api/auth`;
        const verified = await verifyJWTAccessToken(
            auth,
            await sign({
                ...accessTokenClaims(),
                iss: frontendBase,
                aud: frontendBase,
            }),
        );

        expect(verified?.sub).toBe("user-1");
    });

    test("accepts a token issued on a wildcard-allowed dev host", async () => {
        // `*localhost*` lets a worktree run the API on any port, and Better
        // Auth stamps whatever host the token request came through.
        const devBase = "http://localhost:5123/api/auth";
        const verified = await verifyJWTAccessToken(
            auth,
            await sign({ ...accessTokenClaims(), iss: devBase, aud: devBase }),
        );

        expect(verified?.sub).toBe("user-1");
    });

    test("accepts the host exactly as the token request spelled it", async () => {
        // Better Auth keeps the `Host` header as sent, case and default port
        // included, so the issuer can carry either.
        for (const base of [
            "http://LOCALHOST:4000/api/auth",
            "http://localhost:80/api/auth",
            // Fails Better Auth's Host-header syntax check, so it resolves
            // from the request URL instead — and still matches `*localhost*`.
            "http://localhost.:5123/api/auth",
        ]) {
            const verified = await verifyJWTAccessToken(
                auth,
                await sign({ ...accessTokenClaims(), iss: base, aud: base }),
            );
            expect(verified?.sub).toBe("user-1");
        }
    });

    test("rejects a base URL carrying credentials", async () => {
        const base = "http://evil@localhost:4000/api/auth";
        const token = await sign({
            ...accessTokenClaims(),
            iss: base,
            aud: base,
        });

        expect(await verifyJWTAccessToken(auth, token)).toBeNull();
    });

    test("rejects an allowed host under the wrong protocol", async () => {
        // The configured protocol wins when Better Auth resolves the base
        // URL, so it could never have issued this.
        const httpsBase = "https://localhost:4000/api/auth";
        const token = await sign({
            ...accessTokenClaims(),
            iss: httpsBase,
            aud: httpsBase,
        });

        expect(await verifyJWTAccessToken(auth, token)).toBeNull();
    });

    test("rejects a token from another issuer", async () => {
        const token = await sign({
            ...accessTokenClaims(),
            iss: "https://evil.example/api/auth",
        });

        expect(await verifyJWTAccessToken(auth, token)).toBeNull();
    });

    test("rejects a token for another audience", async () => {
        const token = await sign({
            ...accessTokenClaims(),
            aud: "https://some-other-resource.example",
        });

        expect(await verifyJWTAccessToken(auth, token)).toBeNull();
    });

    test("rejects a token only meant for userinfo", async () => {
        const token = await sign({
            ...accessTokenClaims(),
            aud: `${authBase}/oauth2/userinfo`,
        });

        expect(await verifyJWTAccessToken(auth, token)).toBeNull();
    });

    test("rejects a token without an expiry", async () => {
        const token = await sign(without(accessTokenClaims(), "exp"));

        expect(await verifyJWTAccessToken(auth, token)).toBeNull();
    });

    test("rejects an expired token", async () => {
        const token = await sign({
            ...accessTokenClaims(),
            iat: now() - 7200,
            exp: now() - 3600,
        });

        expect(await verifyJWTAccessToken(auth, token)).toBeNull();
    });

    test("rejects an ID token, even one carrying a live sid", async () => {
        // What `/oauth2/token` hands a client with end-session enabled:
        // audience is the client, and no `azp`/`scope`.
        const token = await sign({
            sub: "user-1",
            sid: "session-1",
            aud: "client-1",
            iss: authBase,
            nonce: "n",
            auth_time: now(),
            acr: "urn:mace:incommon:iap:bronze",
            iat: now(),
            exp: now() + 3600,
        });

        expect(await verifyJWTAccessToken(auth, token)).toBeNull();
    });

    test("rejects an ID-token-shaped payload even with our audience", async () => {
        // The second lock: should an ID token ever carry our audience, its
        // claims still give it away.
        const token = await sign({
            ...accessTokenClaims(),
            nonce: "n",
            auth_time: now(),
        });

        expect(await verifyJWTAccessToken(auth, token)).toBeNull();
    });

    test("rejects a token without azp or scope", async () => {
        const noAzp = await sign(without(accessTokenClaims(), "azp"));
        const noScope = await sign(without(accessTokenClaims(), "scope"));

        expect(await verifyJWTAccessToken(auth, noAzp)).toBeNull();
        expect(await verifyJWTAccessToken(auth, noScope)).toBeNull();
    });
});
