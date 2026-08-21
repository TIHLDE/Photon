/**
 * Session cookies are set for the shared parent domain (`.tihlde.org`), so the
 * frontend can forward them from its own host during SSR. They did not always
 * live there: before that, the API set them host-only for `photon.tihlde.org`.
 *
 * A host-only cookie is a different cookie as far as the browser is concerned,
 * and nothing the API sets for `.tihlde.org` ever overwrites it. Members who
 * signed in before the change therefore carry two cookies with the same name,
 * and the browser sends both. Better Auth reads the first one in the header —
 * if that is the old, long-revoked one, the member is "logged out" while a
 * perfectly valid session sits in the second.
 *
 * That is what was happening on 2026-08-21: the stale `photon.tihlde.org`
 * cookie matched no row in `auth_session`, the live `.tihlde.org` one did, and
 * the member was thrown back to the login page every few minutes without ever
 * losing their session. Logging in again does not help — it refreshes the
 * domain-wide cookie and leaves the stale one exactly where it was.
 *
 * So whenever the API sets (or clears) a session cookie for the parent domain,
 * it now expires the host-only twin as well. One login, and the ambiguity is
 * gone for good.
 */

/** The Better Auth cookies that carry a session, whatever prefix they wear. */
const SESSION_COOKIE_SUFFIXES = [".session_token", ".session_data"];

function cookieName(setCookie: string): string | null {
    const name = setCookie.split("=")[0]?.trim();
    return name ? name : null;
}

function isSessionCookie(name: string): boolean {
    return SESSION_COOKIE_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

function hasDomainAttribute(setCookie: string): boolean {
    return /;\s*domain=/i.test(setCookie);
}

/**
 * The header that deletes the host-only twin: same name, no `Domain`, already
 * expired.
 *
 * A `__Secure-` name is only accepted with `Secure` set, so the flag follows
 * the name rather than being assumed — without it the browser drops the header
 * and the stale cookie survives.
 */
function expiredHostOnlyCookie(name: string, secure: boolean): string {
    return [
        `${name}=`,
        "Path=/",
        "Max-Age=0",
        "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        "HttpOnly",
        "SameSite=Lax",
        ...(secure ? ["Secure"] : []),
    ].join("; ");
}

/**
 * Add a delete-header for every host-only session cookie whose domain-wide
 * counterpart this response is setting.
 *
 * Returns the response unchanged when there is nothing to clean up, which is
 * every request except a sign-in, a sign-out, and a session refresh.
 */
export function clearStaleHostOnlySessionCookies(response: Response): Response {
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length === 0) return response;

    const cleared = new Set<string>();
    const additions: string[] = [];

    for (const setCookie of setCookies) {
        const name = cookieName(setCookie);

        if (!name || cleared.has(name)) continue;
        if (!isSessionCookie(name)) continue;
        // Already host-only: this deployment does not use a parent domain (the
        // localhost setup), and there is no twin to clean up.
        if (!hasDomainAttribute(setCookie)) continue;

        cleared.add(name);
        additions.push(
            expiredHostOnlyCookie(
                name,
                name.startsWith("__Secure-") || /;\s*secure/i.test(setCookie),
            ),
        );
    }

    if (additions.length === 0) return response;

    // A response from Better Auth carries mutable headers, but copying them is
    // cheap and cannot be caught out by an immutable one.
    const headers = new Headers(response.headers);
    for (const addition of additions) {
        headers.append("set-cookie", addition);
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}
