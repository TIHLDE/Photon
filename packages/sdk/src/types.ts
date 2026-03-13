import { paths } from "./generated/openapi";

export * from "./generated";

type HTTPMethods = "get" | "post" | "put" | "patch" | "delete" | "options" | "head";

export type QueryParamsHelper<TMethod extends HTTPMethods, TPath extends keyof paths> = NonNullable<
  TMethod extends keyof paths[TPath]
    ? "parameters" extends keyof paths[TPath][TMethod]
      ? "query" extends keyof paths[TPath][TMethod]["parameters"]
        ? paths[TPath][TMethod]["parameters"]["query"]
        : never
      : never
    : never
>;
