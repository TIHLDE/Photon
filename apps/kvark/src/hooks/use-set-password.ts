import { useQuery } from "@tanstack/react-query";

import { authQueryOptions } from "#/api/auth";

/**
 * Whether the member still owes themselves a TIHLDE password, and where to
 * send them for it.
 *
 * The two repairs are not interchangeable. A member with no `credential` row
 * can set one directly, while a member carrying the Lepton migration's
 * placeholder cannot: `/user/me/password` answers 409 as long as a row exists,
 * so their only route is a reset — which works, because linking Feide marks
 * their address verified.
 */
export function useSetPassword() {
    const { data: session } = useQuery(authQueryOptions);
    const state = session?.user.passwordState;

    if (!session || state === undefined || state === "chosen") {
        return { mustSet: false as const };
    }

    return {
        mustSet: true as const,
        state,
        href:
            state === "placeholder"
                ? "/forgot-password"
                : // Carries them back to where they stood, the same way the
                  // Feide sign-up callback does.
                  `/velg-passord?redirectTo=${encodeURIComponent(
                      typeof window === "undefined"
                          ? "/"
                          : window.location.pathname + window.location.search,
                  )}`,
    };
}
