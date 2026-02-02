/**
 * Photon SDK
 *
 * TypeScript SDK for the TIHLDE Photon API.
 *
 * @example
 * ```ts
 * import { createAuthClient } from "@tihlde/photon-sdk/auth";
 * import type { ExtendedSession } from "@tihlde/photon-sdk/types";
 *
 * const auth = createAuthClient({
 *   baseURL: "https://api.tihlde.org",
 * });
 *
 * const session = await auth.getSession();
 * ```
 */

// Re-export all modules
export * from "./auth";
export * from "./types";
export * from "./api";
