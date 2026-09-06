/**
 * `fetch` with a deadline, because the platform default is to wait forever.
 *
 * A call to a service that accepts the connection and then goes quiet holds
 * the request that made it, and with it a database connection, for as long as
 * the other side keeps the socket open. On 13. august 2026 the Feide callback
 * hung that way for 50 minutes and drained the pg pool; the whole API went
 * down behind it.
 *
 * The deadline covers the response body too, not just the headers — an abort
 * tears down the body stream as well — so this is for the small JSON payloads
 * the API exchanges with Feide, Expo and the like. A large download needs a
 * `timeoutMs` sized for the transfer, not this default.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

export type FetchWithTimeoutInit = RequestInit & { timeoutMs?: number };

export async function fetchWithTimeout(
    input: string | URL | Request,
    init: FetchWithTimeoutInit = {},
): Promise<Response> {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init;
    const timeout = AbortSignal.timeout(timeoutMs);

    try {
        return await fetch(input, {
            ...rest,
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
    } catch (error) {
        if (timeout.aborted && !signal?.aborted) {
            throw new Error(
                `Request to ${requestUrlOf(input)} timed out after ${timeoutMs} ms`,
                { cause: error },
            );
        }

        throw error;
    }
}

/**
 * The endpoint an error message may name, with the secret-bearing parts cut.
 *
 * A query string can carry a signed token — a presigned S3 link, an Azure SAS
 * URL — and this ends up in the log. `origin` drops any `user:pass@` along the
 * way. Everything but http(s) is named by scheme alone, because a `data:` URL
 * keeps its whole payload in the path.
 */
function requestUrlOf(input: string | URL | Request): string {
    const href =
        typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;

    try {
        const url = new URL(href);
        return url.protocol === "http:" || url.protocol === "https:"
            ? `${url.origin}${url.pathname}`
            : url.protocol;
    } catch {
        return "the request URL";
    }
}
