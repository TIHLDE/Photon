import { useQuery } from "@tanstack/react-query";

import { authQueryOptions } from "#/api/auth";

/**
 * Whether the member still owes themselves a TIHLDE password, and where to
 * send them for it.
 *
 * Both states end in Better Auth's reset flow — the only way a password is
 * ever added or replaced. A member with no `credential` row gets the
 * `/velg-passord` step, which mails the link to the address on the account; a
 * member carrying the Lepton migration's placeholder goes through "Glemt
 * passord" — which works, because linking Feide marks their address verified.
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
