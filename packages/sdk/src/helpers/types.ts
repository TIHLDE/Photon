import type { Client, Config } from "@hey-api/client-fetch";

/**
 * Extract the query parameters type from an SDK method's options.
 */
export type QueryParams<T extends (options: { query?: unknown }) => unknown> =
    NonNullable<Parameters<T>[0]["query"]>;

/**
 * Extract the path parameters type from an SDK method's options.
 */
export type PathParams<T extends (options: { path?: unknown }) => unknown> =
    NonNullable<Parameters<T>[0]["path"]>;

/**
 * Extract the full payload (options) type from an SDK method.
 */
export type Payload<T extends (options: never) => unknown> = Parameters<T>[0];

/**
 * Extract the return data type from an SDK method.
 */
export type RequestReturnType<
    T extends (...args: never[]) => Promise<{ data?: unknown }>,
> = NonNullable<Awaited<ReturnType<T>>["data"]>;
