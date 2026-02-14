/**
 * API client module - Placeholder for OpenAPI-generated client.
 *
 * TODO: Configure an OpenAPI code generator to generate typed API client.
 *
 * Recommended tools:
 * - openapi-typescript + openapi-fetch: https://openapi-ts.dev
 * - hey-api/openapi-ts: https://heyapi.dev
 * - orval: https://orval.dev
 *
 * Example configuration for openapi-typescript:
 *
 * ```bash
 * pnpm add -D openapi-typescript
 * pnpm add openapi-fetch
 * ```
 *
 * ```ts
 * // openapi-ts.config.ts
 * import { defineConfig } from "@hey-api/openapi-ts";
 *
 * export default defineConfig({
 *   input: "https://api.tihlde.org/openapi",
 *   output: "src/api/generated",
 *   client: "fetch",
 * });
 * ```
 *
 * Once generated, export the client from this file:
 *
 * ```ts
 * export * from "./generated";
 * export { createClient } from "./generated";
 * ```
 */

/**
 * Placeholder API client type.
 * Will be replaced by generated types.
 */
export type ApiClient = Record<string, unknown>;

/**
 * Placeholder for API client factory.
 *
 * @example
 * ```ts
 * import { createApiClient } from "@tihlde/photon-sdk/api";
 *
 * const api = createApiClient({
 *   baseUrl: "https://api.tihlde.org",
 * });
 *
 * // Once generated, you'll have typed methods:
 * // const events = await api.events.list();
 * ```
 */
export function createApiClient(_options: { baseUrl: string }): ApiClient {
    // TODO: Return generated API client instance
    throw new Error(
        "API client not yet implemented. Configure an OpenAPI generator to generate the client.",
    );
}
