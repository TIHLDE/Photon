import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import type { JWTPayload } from "better-auth";
import type { AuthInstance } from "./index";

/**
 * Verified OAuth access token. Returned when the bearer token in
 * `Authorization: Bearer <token>` was issued by our own oauthProvider
 * and passes JWKS signature, issuer, audience, and expiry checks.
 */
export type VerifiedAccessToken = {
    /** The user this token was issued for (`sub` claim). */
    sub: string;
    /** The OAuth client that obtained this token (`client_id` / `azp`). */
    clientId: string;
    /** Granted scopes split on whitespace. */
    scopes: string[];
    /** Raw JWT payload, in case callers need other claims. */
    payload: JWTPayload;
};

/**
 * Verify a bearer token against our own oauthProvider's JWKS.
 *
 * - Local verification only (no introspection round-trip).
 * - Audience and issuer default to `auth.options.baseURL`.
 * - Returns null on any failure (invalid signature, expired, wrong audience,
 *   not a JWT, etc.) so callers can fall through to other auth schemes.
 */
export async function verifyAccessToken(
    auth: AuthInstance,
    token: string | undefined,
): Promise<VerifiedAccessToken | null> {
    if (!token) return null;
    // Quick reject: only JWTs (three dot-separated segments) are oauth access
    // tokens in this setup. Avoids hitting the verifier with API keys / opaque
    // session tokens.
    if (token.split(".").length !== 3) return null;

    try {
        // The `Auth` type used by oauthProviderResourceClient is structurally
        // narrower than the inferred return of betterAuth() — known typing
        // quirk in @better-auth/oauth-provider 1.6.x. Runtime shape matches.
        const client = oauthProviderResourceClient(
            auth as unknown as Parameters<
                typeof oauthProviderResourceClient
            >[0],
        );
        const payload = await client.getActions().verifyAccessToken(token);

        const sub = typeof payload.sub === "string" ? payload.sub : null;
        if (!sub) return null;

        const clientIdClaim =
            (typeof payload.client_id === "string" && payload.client_id) ||
            (typeof payload.azp === "string" && payload.azp) ||
            "";

        const scopeClaim =
            typeof payload.scope === "string" ? payload.scope : "";
        const scopes = scopeClaim.split(/\s+/).filter(Boolean);

        return { sub, clientId: clientIdClaim, scopes, payload };
    } catch {
        return null;
    }
}
