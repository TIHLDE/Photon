/**
 * Auth client factory for the Photon SDK.
 *
 * Creates a typed Better Auth client configured for the Photon backend.
 */

import { createAuthClient as createBetterAuthClient } from "better-auth/client";
import {
    adminClient,
    emailOTPClient,
    usernameClient,
} from "better-auth/client/plugins";
import type {
    BasicSession,
    ExtendedSession,
    GroupMembership,
    Permission,
    Session,
    User,
} from "../types";

/**
 * Options for creating the auth client.
 */
export interface AuthClientOptions {
    /**
     * The base URL of the Photon API server.
     * @example "https://api.tihlde.org"
     */
    baseURL: string;

    /**
     * Custom fetch implementation.
     * Useful for testing or adding custom headers.
     */
    fetchOptions?: {
        customFetchImpl?: typeof fetch;
        headers?: Record<string, string>;
    };
}

/**
 * Creates a typed Better Auth client for the Photon API.
 *
 * @example
 * ```ts
 * import { createAuthClient } from "@tihlde/photon-sdk/auth";
 *
 * const auth = createAuthClient({
 *   baseURL: "https://api.tihlde.org",
 * });
 *
 * // Sign in with email OTP
 * await auth.signIn.emailOtp({ email: "user@example.com" });
 *
 * // Get current session
 * const session = await auth.getSession();
 * ```
 */
export function createAuthClient(options: AuthClientOptions) {
    const client = createBetterAuthClient({
        baseURL: options.baseURL,
        fetchOptions: options.fetchOptions,
        plugins: [adminClient(), emailOTPClient(), usernameClient()],
    });

    return client;
}

/**
 * Type of the auth client returned by createAuthClient.
 */
export type AuthClient = ReturnType<typeof createAuthClient>;

// Re-export types for convenience
export type {
    BasicSession,
    ExtendedSession,
    GroupMembership,
    Permission,
    Session,
    User,
};
