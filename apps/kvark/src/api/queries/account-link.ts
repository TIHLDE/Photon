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
