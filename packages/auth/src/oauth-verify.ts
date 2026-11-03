import { jwtVerify, createLocalJWKSet } from "jose";
import { type JWTPayload, resolveBaseURL } from "better-auth";
import type { AuthInstance } from "./index";
import { z } from "zod";

export type VerifiedAccessToken = {
    sub: string;
    clientId: string;
    scopes: string[];
    sessionId?: string;
    payload: JWTPayload;
};

/**
 * What an access token from `/oauth2/token` carries and an ID token does not.
 *
 * Both are signed with the same JWKS, so the signature alone cannot tell them
 * apart — and an ID token issued to a client with end-session support carries
 * the same `sub`/`sid` pair. The audience check in {@link verifyJWTAccessToken}
 * is what really separates them (an ID token's `aud` is the client id); this
 * shape is the second lock: `azp` and `scope` are only ever set on access
 * tokens, and `nonce`/`auth_time`/`acr` only ever on ID tokens.
 */
const accessTokenPayloadSchema = z
    .object({
        sub: z.string().min(1),
        azp: z.string().min(1),
        scope: z.string(),
        sid: z.string().min(1),
        nonce: z.never().optional(),
        auth_time: z.never().optional(),
        acr: z.never().optional(),
    })
    .transform(({ azp, sid, scope, sub }) => ({
        sub,
        clientId: azp,
        scopes: scope.split(/\s+/).filter(Boolean),
        sessionId: sid,
    }));

/**
 * Whether `candidate` is an auth base URL this server issues tokens under.
 *
 * `baseURL` is dynamic: Better Auth resolves it per request from whichever
 * allowed host the request came through (wildcards included — dev allows
 * `*localhost*`), and the OAuth provider stamps that value into `iss` and uses
 * it as the default (and only) valid `resource`, so `aud` ends up the same.
 * Rather than re-implementing those host rules, ask Better Auth what base URL
 * a request to the candidate's host would get: a URL it would itself have
 * issued under resolves to exactly itself. Anything else — a foreign host, the
 * wrong protocol, the userinfo audience — resolves to something different,
 * or to the fallback.
 */
function isOwnAuthBaseURL(auth: AuthInstance, candidate: unknown): boolean {
    if (typeof candidate !== "string") return false;
    // The authority exactly as written: Better Auth copies the request's
    // `Host` header verbatim into the base URL, so `URL.origin` — which
    // lowercases the host and drops default ports — would turn a URL it
    // genuinely issued under into one that no longer compares equal.
    const match = /^(https?:\/\/)([^/?#]+)/i.exec(candidate);
    const authority = match?.[2];
    if (!match || !authority || authority.includes("@")) return false;
    if (!URL.canParse(`${match[1]}${authority}/`)) return false;
    const { baseURL, basePath } = auth.options;
    try {
        const resolved = resolveBaseURL(
            baseURL,
            basePath ?? "/api/auth",
            // A request, not bare headers: when the `Host` header fails
            // Better Auth's syntax check (`localhost.:5123`) it falls back to
            // the request URL's host, and so must this.
            new Request(`${match[1]}${authority}/`, {
                headers: { host: authority },
            }),
            false,
            false,
        );
        return resolved === candidate;
    } catch {
        return false;
    }
}

/**
 * Verifies a bearer token as an API access token issued by our own OAuth
 * provider: signature, issuer, audience, expiry and purpose. Anything else —
 * an ID token, a token for another resource, a token without `exp` — is
 * `null`, and the caller falls back to cookie auth.
 */
export async function verifyJWTAccessToken(
    auth: AuthInstance,
    token: string | undefined,
): Promise<VerifiedAccessToken | null> {
    if (!token) return null;
    if (token.split(".").length !== 3) return null;

    try {
        const jwks = await auth.api.getJwks();
        const jwksSet = createLocalJWKSet(jwks);

        const { payload } = await jwtVerify(token, jwksSet, {
            requiredClaims: ["iss", "aud", "exp", "iat", "sub"],
        });

        if (!isOwnAuthBaseURL(auth, payload.iss)) return null;
        const audiences = Array.isArray(payload.aud)
            ? payload.aud
            : [payload.aud];
        if (!audiences.some((aud) => isOwnAuthBaseURL(auth, aud))) {
            return null;
        }

        const parsed = accessTokenPayloadSchema.safeParse(payload);
        if (!parsed.success) return null;

        return {
            ...parsed.data,
            payload,
        };
    } catch {
        return null;
    }
}
