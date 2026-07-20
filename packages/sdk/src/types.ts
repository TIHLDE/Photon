import { paths } from "./generated/openapi";

type HTTPMethods =
    | "get"
    | "post"
    | "put"
    | "patch"
    | "delete"
    | "options"
    | "head";

export type QueryParamsHelper<
    TMethod extends HTTPMethods,
    TPath extends keyof paths,
> = NonNullable<
    TMethod extends keyof paths[TPath]
        ? "parameters" extends keyof paths[TPath][TMethod]
            ? "query" extends keyof paths[TPath][TMethod]["parameters"]
                ? paths[TPath][TMethod]["parameters"]["query"]
                : never
            : never
        : never
>;

export type RequestBodyHelper<
    TMehtod extends HTTPMethods,
    TPath extends keyof paths,
> = NonNullable<
    TMehtod extends keyof paths[TPath]
        ? "parameters" extends keyof paths[TPath][TMehtod]
            ? "body" extends keyof paths[TPath][TMehtod]["parameters"]
                ? paths[TPath][TMehtod]["parameters"]["body"]
                : never
            : never
        : never
>;
