import type { Method, QueryParams } from "@photon/fetch-client";
import type { PathsWithMethod } from "openapi-typescript-helpers";
import type { paths } from "#/api/generated";

/** Query parameters of an API operation, e.g. `QueryParamsHelper<"get", "/api/events">`. */
export type QueryParamsHelper<
    TMethod extends Method,
    TPath extends PathsWithMethod<paths, TMethod>,
> = QueryParams<paths, TMethod, TPath>;
