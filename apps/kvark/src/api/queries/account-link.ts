import { mutationOptions } from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";
import type { AccountLinkHelp } from "@tihlde/sdk";

/**
 * Last resort for a member migrated from Lepton who can reach their old
 * account by neither route: their stored username differs from their NTNU one,
 * so Feide finds nothing, and they no longer have the address the account was
 * registered with, so they cannot prove it is theirs either. An admin links it
 * by hand.
 */
export const requestAccountLinkHelpMutation = mutationOptions({
    mutationFn: ({ data }: { data: AccountLinkHelp }) =>
        apiClient.post("/api/account-link/help", {
            json: data,
        }),
});

/**
 * Pulls the caller's study programme, cohort and campus from Feide.
 *
 * Needed because linking cannot do it: Better Auth's link branch attaches the
 * account without minting a session, and the sync hook keys on that session to
 * know who signed in. So a freshly linked member has a working login and no
 * study data — and therefore no study or cohort group, which is what event
 * priority is decided by.
 *
 * Called from `/koble-feide` once the link returns. Idempotent, so a retry or
 * a stray reload costs nothing.
 */
export const syncFeideAccountMutation = mutationOptions({
    mutationFn: () => apiClient.post("/api/account-link/sync"),
});
