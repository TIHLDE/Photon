import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { linkOptions, redirect } from "@tanstack/react-router";
import { getQueryClient } from "#/integrations/tanstack-query";

import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { createPhotonAuthClient } from "@photon/auth/client";

export const clientAuthInstance = createPhotonAuthClient({
    baseUrl: import.meta.env.VITE_AUTH_BASE_URL ?? "https://photon.tihlde.org",
});

export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AuthError";
    }
}

export const getAuthSession = createIsomorphicFn()
    .client(async () => {
        const session = await clientAuthInstance.getSession();
        if (session.error) {
            throw new AuthError(`Failed to get session: ${session.error}`);
        }
        return session.data;
    })
    .server(async () => {
        const session = await clientAuthInstance.getSession({
            fetchOptions: {
                headers: getRequestHeaders(),
            },
        });

        if (session.error) {
            throw new AuthError(`Failed to get session: ${session.error}`);
        }
        return session.data;
    });

export const authQueryOptions = queryOptions({
    queryKey: ["auth"],
    staleTime: 1000 * 60 * 2, // 2 minutes we want to check this frequently
    // A failed session check (network hiccup, API 5xx) is NOT the same as
    // being logged out — getAuthSession only resolves to null when the
    // backend definitively says there is no session. Let errors throw so
    // React Query retries and keeps the previous session in cache instead
    // of silently caching "logged out".
    retry: 2,
    queryFn: () => getAuthSession(),
});

/**
 * Gets tha authenticated user and their permissions
 * @returns auth object with user and permissions
 */
export async function authClient() {
    try {
        return await getQueryClient().ensureQueryData(authQueryOptions);
    } catch {
        // The session check itself failed (after retries). Fall back to the
        // last known session rather than treating the user as logged out —
        // redirecting an authenticated user to /login on a transient error
        // is worse than briefly trusting stale auth state. The API still
        // enforces permissions server-side on every request.
        return getQueryClient().getQueryData(authQueryOptions.queryKey);
    }
}

/**
 * Authenticates the user with the given username and password, and fetches the auth object
 * @param username the username of the user
 * @param password the password of the user
 * @throws {RequestResponse} if the authentication fails or the auth object is not fetched correctly
 */
export async function loginUser(username: string, password: string) {
    const result = await clientAuthInstance.signIn.username({
        username,
        password,
    });

    if (result.error) {
        throw new Error("Kunne ikke logge inn: " + result.error);
    }

    await getQueryClient().invalidateQueries();
    const auth = await authClient();
    if (!auth) {
        throw new Error(
            "Kunne ikke logge inn: Kunne ikke finne brukerinformasjonen din!",
        );
    }

    return auth;
}

/**
 * Invalidates the auth used by authClient for the specified token
 */
export async function invalidateAuth() {
    await getQueryClient().invalidateQueries(authQueryOptions);
}

const GLOBAL_SCOPE = "*";

/**
 * Session permissions arrive as `"events:create"` (global) or
 * `"events:create@group:fotball"` (scoped).
 */
function parsePermission(raw: string): { permission: string; scope: string } {
    const at = raw.indexOf("@");
    if (at === -1) return { permission: raw, scope: GLOBAL_SCOPE };
    return { permission: raw.slice(0, at), scope: raw.slice(at + 1) };
}

/**
 * Whether the session holds a permission GLOBALLY. Returns true if any of
 * `required` matches. `"root"` grants everything.
 *
 * Mirrors `hasPermission` in @photon/auth/rbac: a scoped grant such as
 * `events:create@group:fotball` does NOT satisfy a global check. Keep the two
 * in step — this guard must never be more permissive than the server, which
 * remains the actual enforcement point.
 */
export function sessionHasPermission(
    permissions: string[] | undefined,
    required: string | string[],
): boolean {
    if (!permissions) return false;

    const names = Array.isArray(required) ? required : [required];
    if (names.length === 0) return false;

    if (permissions.includes("root")) return true;

    return names.some((name) =>
        permissions.some((raw) => {
            const parsed = parsePermission(raw);
            return parsed.permission === name && parsed.scope === GLOBAL_SCOPE;
        }),
    );
}

/**
 * Only allow redirecting back to a path on this site. Without this, a crafted
 * `?redirectTo=https://evil.example` would bounce the user off-site after login.
 */
export function sanitizeRedirectTo(url: unknown): string {
    if (typeof url !== "string") return "/";
    // Reject protocol-relative ("//evil.com") and absolute URLs.
    if (!url.startsWith("/") || url.startsWith("//")) return "/";
    return url;
}

/**
 * Attempts to authenticate the user and redirects to the login page if not authenticated
 * @param request the request object from the loader
 * @returns auth object if authenticated
 * @throws redirect to login page if not authenticated
 */
export async function authClientWithRedirect(url: string) {
    const auth = await authClient();
    if (!auth) {
        throw redirect(createLoginRedirectUrl(url));
    }
    return auth;
}

/**
 * Returns the URL to redirect to the login page with the current URL as the redirect target
 * @param request the current request object
 * @returns URL string to redirect to the login page
 */
export function createLoginRedirectUrl(url: string) {
    return linkOptions({
        to: "/login",
        search: {
            redirectTo: sanitizeRedirectTo(url),
        },
    });
}

/**
 * Requires an authenticated session that holds `permission` globally.
 *
 * Unauthenticated visitors are sent to the login page and back afterwards.
 * A signed-in user without the permission is sent to the front page rather
 * than the login page — re-authenticating would not help them.
 *
 * This gates the UI only. The API enforces the same permissions server-side
 * via `requireAccess`, and that is what actually protects the data.
 */
export async function authClientWithPermission(
    url: string,
    permission: string | string[],
) {
    const auth = await authClientWithRedirect(url);

    if (!sessionHasPermission(auth.permissions, permission)) {
        throw redirect({ to: "/" });
    }

    return auth;
}

/**
 * Starts the Feide (Dataporten) OAuth flow. This hands the browser off to
 * Feide, which redirects back to the backend callback and finally to
 * `callbackURL` on success. Provider id must match `feidePlugin` in
 * @photon/auth. Requires the backend Feide client to be configured.
 *
 * The callbacks MUST be absolute frontend URLs: Better Auth resolves a
 * relative callback against its own baseURL — the API host — so a plain "/"
 * dumps the user on photon.tihlde.org (a 404 from the API router) instead of
 * back on the website. Sanitized first, so only same-site paths are ever
 * absolutized. Browser-only, so window.location.origin is available.
 */
export async function signInWithFeide(callbackURL: string) {
    const toFrontendUrl = (path: string) =>
        new URL(sanitizeRedirectTo(path), window.location.origin).toString();

    const result = await clientAuthInstance.signIn.oauth2({
        providerId: "feide",
        callbackURL: toFrontendUrl(callbackURL),
        errorCallbackURL: toFrontendUrl("/login"),
    });

    if (result.error) {
        throw new Error(
            result.error.message ?? "Kunne ikke starte Feide-innlogging",
        );
    }

    // The endpoint returns the Dataporten authorization URL to redirect to.
    if (result.data && "url" in result.data && result.data.url) {
        window.location.href = result.data.url;
    }

    return result.data;
}

export async function logoutUser() {
    await clientAuthInstance.signOut();
    await invalidateAuth();
}

export const changePasswordMutationOptions = mutationOptions({
    mutationFn: async ({
        newPassword,
        token,
    }: {
        newPassword: string;
        token: string;
    }) => {
        const result = await clientAuthInstance.resetPassword({
            newPassword,
            token,
        });
        if (result.error) {
            throw new Error(
                "Kunne ikke endre passord: " + result.error.message,
            );
        }
        return result.data;
    },
});

export type SignInEmailResult =
    | { redirect?: boolean; url?: string }
    | { user: unknown; session: unknown };

export const signInEmailMutationOptions = mutationOptions({
    mutationFn: async ({
        email,
        password,
    }: {
        email: string;
        password: string;
    }) => {
        const result = await clientAuthInstance.signIn.email({
            email,
            password,
        });
        if (result.error) {
            throw new Error(result.error.message ?? "Innlogging feilet");
        }
        return result.data as SignInEmailResult;
    },
});

export const signInUsernameMutationOptions = mutationOptions({
    mutationFn: async ({
        username,
        password,
    }: {
        username: string;
        password: string;
    }) => {
        const result = await clientAuthInstance.signIn.username({
            username,
            password,
        });
        if (result.error) {
            throw new Error(result.error.message ?? "Innlogging feilet");
        }
        return result.data as SignInEmailResult;
    },
});

export type SignUpEmailResult =
    | { user: unknown; session: { token: string } | null }
    | { redirect?: boolean; url?: string };

export const signUpEmailMutationOptions = mutationOptions({
    mutationFn: async ({
        name,
        email,
        password,
    }: {
        name: string;
        email: string;
        password: string;
    }) => {
        const result = await clientAuthInstance.signUp.email({
            name,
            email,
            password,
        });
        if (result.error) {
            throw new Error(result.error.message ?? "Registrering feilet");
        }
        return result.data as SignUpEmailResult;
    },
});

export const requestPasswordResetMutationOptions = mutationOptions({
    mutationFn: async ({
        email,
        redirectTo,
    }: {
        email: string;
        redirectTo: string;
    }) => {
        const result = await clientAuthInstance.requestPasswordReset({
            email,
            redirectTo,
        });
        if (result.error) {
            throw new Error(
                result.error.message ?? "Kunne ikke sende lenke akkurat nå.",
            );
        }
        return result.data;
    },
});
