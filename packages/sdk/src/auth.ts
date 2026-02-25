import { BetterAuthClientOptions } from "better-auth/client";
import {
    customSessionClient,
    genericOAuthClient,
    usernameClient,
} from "better-auth/client/plugins";
import type { AuthInstance } from "@photon/auth";

export function createPhotonClientAuthOptions(options: { baseURL: string }) {
    return {
        baseURL: options.baseURL,
        plugins: [
            genericOAuthClient(),
            usernameClient(),
            customSessionClient<AuthInstance>(),
        ],
    } satisfies BetterAuthClientOptions;
}
