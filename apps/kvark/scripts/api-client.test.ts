import { afterAll, expect, mock, spyOn, test } from "bun:test";

let cookie = "session=first";
mock.module("@tanstack/react-start", () => ({
    createIsomorphicFn: () => ({
        client: () => ({ server: (fn: () => string | undefined) => fn }),
    }),
}));
mock.module("@tanstack/react-start/server", () => ({
    getRequestHeaders: () => ({ cookie }),
}));

const { apiClient } = await import("../src/api/api-client");
apiClient.setBaseUrl("https://photon.tihlde.org");
const { TypedStatusError } = await import("@photon/codegen");
let response = Response.json({ items: [], totalCount: 0 });
const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(async () => response, {
        preconnect: globalThis.fetch.preconnect,
    }),
);
afterAll(() => fetchSpy.mockRestore());

// Exercises the generated client + fetcher and the app's thin SSR/error adapter.
test("generated transport preserves request options, uploads, HTTP outcomes, and session isolation", async () => {
    await apiClient.get("/api/event", { query: { page: 2, pageSize: 10 } });
    const [url, options] = fetchSpy.mock.calls.at(-1)!;
    expect(String(url)).toBe(
        "https://photon.tihlde.org/api/event?page=2&pageSize=10",
    );
    expect(options?.credentials).toBe("include");
    expect(new Headers(options?.headers).get("cookie")).toBe("session=first");

    const signal = new AbortController().signal;
    response = Response.json({ message: "OK" });
    await apiClient.post("/api/user/me/password", {
        body: { newPassword: "example-password" },
        overrides: { signal, headers: { "x-request-id": "test" } },
    });
    const jsonOptions = fetchSpy.mock.calls.at(-1)![1];
    expect(jsonOptions?.body).toBe(
        JSON.stringify({ newPassword: "example-password" }),
    );
    expect(jsonOptions?.signal).toBe(signal);
    expect(new Headers(jsonOptions?.headers).get("content-type")).toBe(
        "application/json",
    );
    expect(new Headers(jsonOptions?.headers).get("x-request-id")).toBe("test");

    cookie = "session=second";
    response = Response.json({ key: "image.webp" }, { status: 201 });
    const file = new File(["image"], "image.png", { type: "image/png" });
    const uploaded = await apiClient.post("/api/assets", {
        body: { file, visibility: "private" },
    });
    expect(uploaded.key).toBe("image.webp");
    const uploadOptions = fetchSpy.mock.calls.at(-1)![1];
    expect(uploadOptions?.body).toBeInstanceOf(FormData);
    expect((uploadOptions?.body as FormData).get("visibility")).toBe("private");
    expect(new Headers(uploadOptions?.headers).has("content-type")).toBe(false);
    expect(new Headers(uploadOptions?.headers).get("cookie")).toBe(
        "session=second",
    );

    response = new Response(null, { status: 204 });
    await apiClient.delete("/api/event/{eventId}", {
        path: { eventId: "a/b" },
    });
    expect(String(fetchSpy.mock.calls.at(-1)![0])).toBe(
        "https://photon.tihlde.org/api/event/a%2Fb",
    );

    response = Response.json({ message: "Ikke tilgang" }, { status: 403 });
    await expect(apiClient.get("/api/contracts/active")).rejects.toMatchObject({
        name: "TypedStatusError",
        status: 403,
        message: "Ikke tilgang",
    });

    response = Response.json(
        { success: false, error: [{ path: ["title"], message: "Required" }] },
        { status: 400 },
    );
    await expect(apiClient.get("/api/contracts/active")).rejects.toThrow(
        "title: Required",
    );

    response = Response.json({ message: "Not found" }, { status: 404 });
    const result = await apiClient.get("/api/contracts/active", {
        withResponse: true,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    const unthrown: unknown = await apiClient.get("/api/contracts/active", {
        throwOnStatusError: false,
    });
    expect(unthrown).toEqual({ message: "Not found" });

    response = new Response("Proxy failure", { status: 502 });
    await expect(apiClient.get("/api/contracts/active")).rejects.toBeInstanceOf(
        TypedStatusError,
    );

    fetchSpy.mockRejectedValueOnce(new TypeError("Network failure"));
    await expect(apiClient.get("/api/contracts/active")).rejects.toThrow(
        "Network failure",
    );
});

// Compile-time checks: the generator owns paths, request types, and response inference.
function checkTypes() {
    // @ts-expect-error unknown route
    apiClient.get("/api/not-a-route");
    // @ts-expect-error required path parameter
    apiClient.get("/api/event/{eventId}");
    // @ts-expect-error upload needs a binary file
    apiClient.post("/api/assets", { body: { file: "not a file" } });
}
void checkTypes;
