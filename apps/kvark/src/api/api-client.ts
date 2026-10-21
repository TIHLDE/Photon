import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
    createApiClient,
    defaultFetcher,
    TypedStatusError,
    type Fetcher,
    type ErrorStatusCode,
} from "@photon/codegen";
import { validationIssueMessage } from "#/lib/validation-message";

// SSR has no browser cookie jar. Read cookies per request, never at module scope.
const getServerCookie = createIsomorphicFn()
    .client(() => undefined as string | undefined)
    .server(() => new Headers(getRequestHeaders()).get("cookie") ?? undefined);

const fetchWithSession: Fetcher["fetch"] = async (input) => {
    const headers = new Headers(input.overrides?.headers);
    const cookie = getServerCookie();
    if (cookie) headers.set("cookie", cookie);
    const response = await defaultFetcher({
        ...input,
        overrides: { credentials: "include", ...input.overrides, headers },
    });

    // Keep API and validation messages visible to existing error boundaries/toasts.
    // withResponse and throwOnStatusError:false still use the generated response handling.
    if (
        input.throwOnStatusError &&
        response.status >= 400 &&
        response.status <= 599
    ) {
        const data: unknown = await response
            .clone()
            .json()
            .catch(() => undefined);
        const error = new TypedStatusError({
            ok: false,
            status: response.status as ErrorStatusCode,
            statusText: response.statusText,
            headers: response.headers,
            body: response.body,
            data,
            json: async () => data,
            text: () => response.text(),
            arrayBuffer: () => response.arrayBuffer(),
            clone: () => response.clone(),
        });
        const message =
            data && typeof data === "object" && "message" in data
                ? data.message
                : undefined;
        if (typeof message === "string" && message) error.message = message;
        else if (data && typeof data === "object")
            error.message = validationIssueMessage(data) ?? error.message;
        throw error;
    }
    return response;
};

export const apiClient = createApiClient(
    { fetch: fetchWithSession },
    (import.meta.env.VITE_API_URL ?? "https://photon.tihlde.org").replace(
        /\/$/,
        "",
    ),
);
