import { redirect } from "@tanstack/react-router";

import {
    authClientWithRedirect,
    sessionHasPermissionInAnyScope,
} from "#/api/auth";
import {
    ADMIN_SECTION_PERMISSIONS,
    ALL_ADMIN_SECTION_PERMISSIONS,
    type AdminSection,
} from "#/lib/admin-sections";

/**
 * Just enough of the session to answer "may this person open the panel".
 * Structural so both the route context's `auth` and the cached session query
 * fit without either having to know about this module.
 */
type AdminSession = {
    permissions?: string[] | null;
    groups?: readonly { role?: string | null }[] | null;
};

/** Group leaders act on their own group without holding a global grant. */
function leadsAnyGroup(session: AdminSession): boolean {
    return Boolean(session.groups?.some((group) => group.role === "leader"));
}

/**
 * Whether the session has anything at all to do in the admin panel.
 *
 * The same question {@link useIsAdmin} answers for the command menu and the
 * sidebar, read straight off a session so the router can ask it before the
 * page renders. Reading the section map means the guard cannot drift from
 * what the sidebar offers.
 */
export function canOpenAdminPanel(session: AdminSession): boolean {
    return (
        sessionHasPermissionInAnyScope(
            session.permissions ?? undefined,
            ALL_ADMIN_SECTION_PERMISSIONS,
        ) || leadsAnyGroup(session)
    );
}

/** Whether the session may open one specific section of the panel. */
export function canOpenAdminSection(
    session: AdminSession,
    section: AdminSection,
    options: { allowGroupLeader?: boolean } = {},
): boolean {
    if (options.allowGroupLeader && leadsAnyGroup(session)) return true;
    return sessionHasPermissionInAnyScope(
        session.permissions ?? undefined,
        ADMIN_SECTION_PERMISSIONS[section],
    );
}

/**
 * Route guard for the admin shell: signed in, and holding something that
 * opens at least one section.
 *
 * Unauthenticated visitors go to the login page and back afterwards. A
 * signed-in member without any admin work is sent to the front page —
 * logging in again would not help them.
 */
export async function requireAdminPanel(url: string) {
    const auth = await authClientWithRedirect(url);

    if (!canOpenAdminPanel(auth)) {
        throw redirect({ to: "/" });
    }

    return auth;
}

/**
 * Route guard for one section. Mirrors the sidebar entry exactly, including
 * `allowGroupLeader` — a leader reaches Grupper and Tilganger without any
 * global grant, because the API lets them act on their own group.
 *
 * Cosmetic, like every check in this app: the API enforces the same
 * permissions on each request, and that is what protects the data. This only
 * keeps people out of pages that could never answer them anything.
 */
export async function requireAdminSection(
    url: string,
    section: AdminSection,
    options: {
        allowGroupLeader?: boolean;
        /**
         * Narrower requirement for a single page inside the section — "Nytt
         * arrangement" takes `events:create`, not merely something that opens
         * Arrangementer.
         */
        permission?: string | readonly string[];
    } = {},
) {
    const auth = await requireAdminPanel(url);

    if (!canOpenAdminSection(auth, section, options)) {
        throw redirect({ to: "/admin" });
    }

    if (
        options.permission &&
        !sessionHasPermissionInAnyScope(
            auth.permissions ?? undefined,
            options.permission,
        )
    ) {
        throw redirect({ to: "/admin" });
    }

    return auth;
}
