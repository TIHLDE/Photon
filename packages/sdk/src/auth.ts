import { createAuthClient } from "better-auth/react";
import {
    customSessionClient,
    genericOAuthClient,
    usernameClient,
} from "better-auth/client/plugins";
import type { AuthInstance } from "@photon/auth";

export function createPhotonAuthClient(options: { baseURL: string }) {
    return createAuthClient({
        baseURL: options.baseURL,
        plugins: [
            genericOAuthClient(),
            usernameClient(),
            customSessionClient<AuthInstance>(),
        ],
    });
}

export type { AuthInstance };
