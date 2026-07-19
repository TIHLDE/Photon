import { AuthUser } from "@photon/auth";

/**
 * Get the bearer token from the Authorization header
 * @param authHeader the Authorization header value
 * @returns the token if the header is correctly formatted, otherwise undefined
 */
export function getBearerTokenFromHeader(authHeader: string | undefined) {
    if (authHeader == null) return undefined;
    if (!authHeader.toLowerCase().startsWith("bearer ")) return undefined;
    const token = authHeader.slice("bearer ".length);
    return token;
}

/**
 * Build a `User`-shaped object from a verified JWT payload.
 *
 * Only the fields routes actually read (`id`, `email`, `name`) are taken from
 * the token; the rest are filled with neutral defaults. This avoids a DB
 * round-trip per request. If a future route needs another field, either add
 * it to `jwt.definePayload` or fetch it explicitly from `db`.
 */
export function userFromClaims(sub: string, payload: Record<string, unknown>) {
    const now = new Date(0);
    return {
        id: sub,
        email: typeof payload.email === "string" ? payload.email : "",
        name: typeof payload.name === "string" ? payload.name : "",
        emailVerified: false,
        role: null,
        image: null,
        username: null,
        displayUsername: null,
        legacyToken: null,
        banned: null,
        banReason: null,
        banExpires: null,
        settings: null,
        createdAt: now,
        updatedAt: now,
    } as unknown as AuthUser;
}
