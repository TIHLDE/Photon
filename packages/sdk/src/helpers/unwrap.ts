import type { Client } from "@hey-api/client-fetch";

type SdkFunction = (...args: never[]) => Promise<{
    data?: unknown;
    error?: unknown;
    response: Response;
}>;

type UnwrappedReturn<T extends SdkFunction> = Awaited<ReturnType<T>> extends {
    data: infer D;
}
    ? D
    : never;

type UnwrappedSdk<T> = {
    [K in keyof T]: T[K] extends SdkFunction
        ? (
              ...args: Parameters<T[K]>
          ) => Promise<NonNullable<UnwrappedReturn<T[K]>>>
        : T[K];
};

/**
 * Wraps SDK methods to return `data` directly and throw on error.
 *
 * @example
 * ```ts
 * import { client, getEvents } from "@tihlde/sdk";
 * const sdk = unwrapSdk({ getEvents });
 * const events = await sdk.getEvents(); // returns data directly, throws on error
 * ```
 */
export function unwrapSdk<T extends Record<string, SdkFunction | Client>>(
    sdkMethods: T,
): UnwrappedSdk<T> {
    return new Proxy(sdkMethods, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            if (typeof value !== "function" || prop === "client") {
                return value;
            }
            return async (...args: unknown[]) => {
                const result = await (value as SdkFunction)(
                    ...(args as never[]),
                );
                if (result.error) {
                    throw result.error;
                }
                return result.data;
            };
        },
    }) as UnwrappedSdk<T>;
}
