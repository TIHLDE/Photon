/**
 * Minimal storage client type for auth package.
 * The full implementation lives in apps/api.
 * This is only used as a type constraint for createAuth.
 */
// biome-ignore lint/suspicious/noExplicitAny: Storage client is opaque to auth package
export type StorageClient = Record<string, any>;
