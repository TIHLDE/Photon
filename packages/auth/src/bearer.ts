/**
 * Bearer token parsing utilities.
 */

export type ParseBearerResult =
    | { success: true; token: string }
    | { success: false; error: string };

/**
 * Parse a Bearer token from an Authorization header.
 *
 * @param authHeader - The Authorization header value
 * @returns The parsed token or an error
 *
 * @example
 * const result = parseBearer(c.req.header("Authorization"));
 * if (!result.success) {
 *     throw new HTTPException(401, { message: result.error });
 * }
 * const token = result.token;
 */
export function parseBearer(authHeader: string | undefined): ParseBearerResult {
    if (!authHeader) {
        return {
            success: false,
            error: "Authorization header required",
        };
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
        return {
            success: false,
            error: 'Invalid Authorization header format. Expected "Bearer <token>"',
        };
    }

    return { success: true, token: parts[1] };
}

/**
 * Parse a Bearer token from an Authorization header, returning null if invalid.
 * Useful for optional auth scenarios.
 *
 * @param authHeader - The Authorization header value
 * @returns The token or null if invalid/missing
 *
 * @example
 * const token = parseBearerOptional(c.req.header("Authorization"));
 * if (token) {
 *     // Use token
 * }
 */
export function parseBearerOptional(
    authHeader: string | undefined,
): string | null {
    const result = parseBearer(authHeader);
    return result.success ? result.token : null;
}
