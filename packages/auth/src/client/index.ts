import { createAuthClient as createBetterAuthClient } from "better-auth/client";
import {
    adminClient,
    emailOTPClient,
    genericOAuthClient,
    usernameClient,
} from "better-auth/client/plugins";

export function createAuthClient(options: { baseURL: string }) {
    return createBetterAuthClient({
        baseURL: options.baseURL,
        plugins: [
            adminClient(),
            genericOAuthClient(),
            usernameClient(),
            emailOTPClient(),
        ],
    });
}

export type AuthClient = ReturnType<typeof createAuthClient>;
