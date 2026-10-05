import ky, { HTTPError, type Options } from "ky";
import type {
    ErrorResponseJSON,
    FilterKeys,
    IsOperationRequestBodyOptional,
    JSONLike,
    OperationRequestBody,
    PathsWithMethod,
    RequiredKeysOf,
    SuccessResponseJSON,
} from "openapi-typescript-helpers";

export { HTTPError };

const methods = ["get", "post", "put", "patch", "delete"] as const;
type Method = (typeof methods)[number];

type ParamGroup<O, K extends "path" | "query"> = O extends {
    parameters: infer P;
}
    ? NonNullable<FilterKeys<P, K>>
    : never;
type ParamOption<K extends string, T> = [T] extends [never]
    ? {}
    : RequiredKeysOf<T> extends never
      ? { [P in K]?: T }
      : { [P in K]: T };
// The helpers' RequestBodyJSON cannot see through an optional `requestBody?`.
type JSONBody<O> = JSONLike<
    FilterKeys<NonNullable<OperationRequestBody<O>>, "content">
>;
// Operations without a documented body accept FormData for undocumented uploads (e.g. /api/assets).
type BodyOption<O, M extends Method> = M extends "get"
    ? {}
    : [JSONBody<O>] extends [never]
      ? { body?: FormData }
      : IsOperationRequestBodyOptional<O> extends true
        ? { body?: JSONBody<O> }
        : { body: JSONBody<O> };
type TransportOptions = Omit<
    Options,
    "method" | "body" | "json" | "searchParams" | "throwHttpErrors" | "prefix"
>;
type CallOptions<O, M extends Method> = TransportOptions &
    ParamOption<"params", ParamGroup<O, "path">> &
    ParamOption<"query", ParamGroup<O, "query">> &
    BodyOption<O, M>;
type OptionsArgument<O, M extends Method> =
    {} extends CallOptions<O, M>
        ? [options?: CallOptions<O, M>]
        : [options: CallOptions<O, M>];
type Responses<O> = O extends Record<string, unknown> ? O : never;

export class FetchError extends Error {
    // Prevent structural overlap with HTTPError so tuple narrowing preserves its data type.
    private readonly fetchErrorBrand = true;
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "FetchError";
    }
}
type Result<T, E> = [HTTPError<E> | FetchError, null] | [null, T];
export type FetchRequest<T, E> = {
    json(): Promise<T>;
    raw(): Promise<Response>;
    result(): Promise<Result<T, E>>;
    throwOnStatus(): Pick<FetchRequest<T, E>, "json" | "raw">;
};
export type FetchClient<Paths extends object> = {
    [M in Method as PathsWithMethod<Paths, M> extends never ? never : M]: <
        P extends PathsWithMethod<Paths, M>,
    >(
        path: P,
        ...options: OptionsArgument<FilterKeys<Paths[P], M>, M>
    ) => FetchRequest<
        SuccessResponseJSON<Responses<FilterKeys<Paths[P], M>>>,
        ErrorResponseJSON<Responses<FilterKeys<Paths[P], M>>>
    >;
};

type RuntimeOptions = TransportOptions & {
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: unknown;
};

export function createFetchClient<Paths extends object>(
    options: { prefix?: string } & TransportOptions = {},
): FetchClient<Paths> {
    const api = ky.create(options);
    const client: Partial<
        Record<
            Method,
            (
                path: string,
                options?: RuntimeOptions,
            ) => FetchRequest<unknown, unknown>
        >
    > = {};
    for (const method of methods) {
        client[method] = (path, requestOptions = {}) => {
            let used = false;
            let throwStatus = false;
            const execute = async (
                terminal: "json" | "raw",
            ): Promise<unknown> => {
                if (used)
                    throw new Error("This request has already been consumed");
                used = true;
                const {
                    params = {},
                    query = {},
                    body,
                    ...fetchOptions
                } = requestOptions;
                const target = path.replace(
                    /\{([^}]+)\}/g,
                    (_, key: string) => {
                        if (params[key] == null)
                            throw new Error(`Missing path parameter: ${key}`);
                        return encodeURIComponent(String(params[key]));
                    },
                );
                const searchParams = new URLSearchParams();
                for (const [key, value] of Object.entries(query)) {
                    for (const item of Array.isArray(value) ? value : [value]) {
                        if (item != null)
                            searchParams.append(key, String(item));
                    }
                }
                const pending = api(target, {
                    ...fetchOptions,
                    method,
                    searchParams,
                    ...(body instanceof FormData ? { body } : { json: body }),
                    throwHttpErrors: terminal === "json" || throwStatus,
                });
                const response = await pending;
                if (terminal === "raw") return response;
                if (response.status === 204) return undefined;
                return pending.json();
            };
            const request: FetchRequest<unknown, unknown> = {
                json: () => execute("json"),
                raw: () => execute("raw") as Promise<Response>,
                result: async () => {
                    try {
                        return [null, await execute("json")];
                    } catch (cause) {
                        return [
                            cause instanceof HTTPError
                                ? cause
                                : new FetchError(
                                      cause instanceof Error
                                          ? cause.message
                                          : String(cause),
                                      { cause },
                                  ),
                            null,
                        ];
                    }
                },
                throwOnStatus: () => {
                    throwStatus = true;
                    return { json: request.json, raw: request.raw };
                },
            };
            return request;
        };
    }
    // The OpenAPI schema is type-only; all method implementations share the same transport.
    return client as FetchClient<Paths>;
}
