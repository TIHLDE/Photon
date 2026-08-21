import { describe, expect, it } from "vitest";
import { clearStaleHostOnlySessionCookies } from "~/lib/auth-cookies";

/**
 * A member who signed in before session cookies moved to the shared parent
 * domain carries two cookies with the same name: the live `.tihlde.org` one and
 * a host-only leftover for `photon.tihlde.org` that nothing ever overwrites.
 * The browser sends both, and Better Auth reads whichever comes first — so a
 * long-dead cookie logs them out while a valid session sits right behind it.
 *
 * Reproduced in production on 2026-08-21: the host-only cookie matched no row
 * in `auth_session`, the domain-wide one did.
 */

const SECURE_TOKEN = "__Secure-tihlde.session_token";
const SECURE_DATA = "__Secure-tihlde.session_data";

function responseWith(setCookies: string[]): Response {
    const headers = new Headers();
    for (const cookie of setCookies) {
        headers.append("set-cookie", cookie);
    }
    return new Response(null, { status: 200, headers });
}

function cookiesFrom(response: Response) {
    return response.headers.getSetCookie();
}

describe("clearStaleHostOnlySessionCookies", () => {
    it("expires the host-only twin when a session cookie is set", () => {
        const response = clearStaleHostOnlySessionCookies(
            responseWith([
                `${SECURE_TOKEN}=abc123; Path=/; Domain=.tihlde.org; HttpOnly; Secure; SameSite=Lax`,
            ]),
        );

        const cookies = cookiesFrom(response);
        expect(cookies).toHaveLength(2);

        const clearing = cookies.find((c) => !c.includes("Domain="));
        expect(clearing).toBeDefined();
        expect(clearing).toContain(`${SECURE_TOKEN}=;`);
        expect(clearing).toContain("Max-Age=0");
        // A `__Secure-` name is rejected without this, and the stale cookie
        // would survive.
        expect(clearing).toContain("Secure");
        expect(clearing).toContain("HttpOnly");

        // The real cookie is untouched.
        expect(cookies).toContain(
            `${SECURE_TOKEN}=abc123; Path=/; Domain=.tihlde.org; HttpOnly; Secure; SameSite=Lax`,
        );
    });

    it("covers the cookie cache as well as the session token", () => {
        const response = clearStaleHostOnlySessionCookies(
            responseWith([
                `${SECURE_TOKEN}=abc; Path=/; Domain=.tihlde.org; Secure`,
                `${SECURE_DATA}=def; Path=/; Domain=.tihlde.org; Secure`,
            ]),
        );

        const cleared = cookiesFrom(response).filter(
            (c) => !c.includes("Domain="),
        );
        expect(cleared).toHaveLength(2);
        expect(cleared.some((c) => c.startsWith(`${SECURE_TOKEN}=;`))).toBe(
            true,
        );
        expect(cleared.some((c) => c.startsWith(`${SECURE_DATA}=;`))).toBe(
            true,
        );
    });

    it("cleans up on sign-out too, when the cookie is being cleared", () => {
        const response = clearStaleHostOnlySessionCookies(
            responseWith([
                `${SECURE_TOKEN}=; Path=/; Domain=.tihlde.org; Max-Age=0; Secure`,
            ]),
        );

        // Signing out has to take the twin with it, or the next page load
        // authenticates as whoever the stale cookie points at.
        expect(cookiesFrom(response)).toHaveLength(2);
    });

    it("leaves a host-only setup alone", () => {
        // localhost dev: frontend and API share a hostname, so cookies are
        // host-only by design and there is no twin.
        const setCookie = "tihlde.session_token=abc; Path=/; HttpOnly";
        const response = clearStaleHostOnlySessionCookies(
            responseWith([setCookie]),
        );

        expect(cookiesFrom(response)).toEqual([setCookie]);
    });

    it("omits Secure for an unprefixed cookie that did not ask for it", () => {
        const response = clearStaleHostOnlySessionCookies(
            responseWith([
                "tihlde.session_token=abc; Path=/; Domain=.tihlde.test; HttpOnly",
            ]),
        );

        const clearing = cookiesFrom(response).find(
            (c) => !c.includes("Domain="),
        );
        expect(clearing).toBeDefined();
        expect(clearing).not.toContain("Secure");
    });

    it("ignores responses with no session cookie", () => {
        const setCookie = "ui-theme=dark; Path=/";
        const response = clearStaleHostOnlySessionCookies(
            responseWith([setCookie]),
        );

        expect(cookiesFrom(response)).toEqual([setCookie]);
    });

    it("keeps the body and status of the response it wraps", async () => {
        const headers = new Headers();
        headers.append(
            "set-cookie",
            `${SECURE_TOKEN}=abc; Path=/; Domain=.tihlde.org; Secure`,
        );
        const original = new Response(JSON.stringify({ ok: true }), {
            status: 201,
            statusText: "Created",
            headers,
        });

        const response = clearStaleHostOnlySessionCookies(original);

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({ ok: true });
    });
});
