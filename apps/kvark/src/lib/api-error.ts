/** Prefer the API's own error message over ky's generic HTTP status text. */
export async function extractErrorMessage(error: unknown): Promise<string> {
    // Structural check instead of `instanceof HTTPError` — Vite can bundle
    // duplicate ky instances, which breaks instanceof across modules.
    const response =
        error && typeof error === "object" && "response" in error
            ? error.response
            : null;
    if (response instanceof Response) {
        try {
            const body = (await response.clone().json()) as {
                message?: string;
            };
            if (body.message) {
                return body.message;
            }
        } catch {
            // Fall through to the generic message.
        }
    }
    return error instanceof Error ? error.message : String(error);
}
