import { describe, expect, test } from "bun:test";
import { createFetchClient, FetchError, HTTPError } from "./src/index";

// Mirrors the shape openapi-typescript generates for Photon.
type Paths = {
    "/things/{id}": {
        get: {
            parameters: {
                path: { id: string };
                query: { required: string; years?: number[]; omit?: null };
            };
            requestBody?: never;
            responses: {
                200: { content: { "application/json": { id: string } } };
                400: { content: { "application/json": { message: string } } };
            };
        };
        post: {
            parameters: { path: { id: string } };
            requestBody: {
                content: { "application/json": { name: string } };
            };
            responses: {
                201: { content: { "application/json": { id: string } } };
            };
        };
        delete: {
            parameters: { path: { id: string }; query: { confirm: string } };
            requestBody?: never;
            responses: { 204: { content?: never } };
        };
    };
    "/patchable/{id}": {
        patch: {
            parameters: { path: { id: string } };
            requestBody?: {
                content: { "application/json": { name?: string } };
            };
            responses: {
                200: { content: { "application/json": { id: string } } };
            };
        };
    };
    "/repeat/{id}/related/{id}": {
        get: {
            parameters: { path: { id: string } };
            responses: {
                200: { content: { "application/json": { id: string } } };
            };
        };
    };
    "/api/assets": {
        post: {
            requestBody?: never;
            responses: {
                201: { content: { "application/json": { key: string } } };
            };
        };
    };
    "/csv": {
        get: { responses: { 200: { content: { "text/csv": string } } } };
    };
    "/mixed": {
        get: {
            parameters: { query?: { page?: number } };
            responses: {
                200: { content: { "application/json": { id: string } } };
                204: { content?: never };
            };
        };
    };
};

type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
        ? true
        : false;
type Assert<T extends true> = T;

// These checks must compile, but must not start requests during the test run.
function _typeChecks() {
    const client = createFetchClient<Paths>();
    const thing = { params: { id: "x" }, query: { required: "x" } };

    client.get("/things/{id}", thing);
    client.get("/mixed");
    client.get("/mixed", { query: { page: 2 } });
    client.post("/things/{id}", { params: { id: "x" }, body: { name: "x" } });
    client.delete("/things/{id}", {
        params: { id: "x" },
        query: { confirm: "x" },
    });
    client.post("/api/assets", { body: new FormData() });
    client.patch("/patchable/{id}", { params: { id: "x" } });
    client.patch("/patchable/{id}", { params: { id: "x" }, body: {} });
    client.patch("/patchable/{id}", {
        params: { id: "x" },
        body: { name: "x" },
    });

    // @ts-expect-error unknown path
    client.get("/missing");
    // @ts-expect-error this method is not documented on this path
    client.delete("/csv");
    // @ts-expect-error missing required path params and query
    client.get("/things/{id}");
    // @ts-expect-error required query is missing
    client.delete("/things/{id}", { params: { id: "x" } });
    // @ts-expect-error missing required body
    client.post("/things/{id}", { params: { id: "x" } });
    // @ts-expect-error body shape is validated
    client.post("/things/{id}", { params: { id: "x" }, body: { name: 1 } });
    // @ts-expect-error FormData is not valid for JSON request bodies
    client.post("/things/{id}", { params: { id: "x" }, body: new FormData() });
    // @ts-expect-error undocumented bodies only accept FormData
    client.post("/api/assets", { body: { key: "x" } });
    client.patch("/patchable/{id}", {
        params: { id: "x" },
        // @ts-expect-error optional bodies still validate their shape
        body: { name: 1 },
    });
    // @ts-expect-error GET has no body
    client.get("/mixed", { body: new FormData() });
    // @ts-expect-error per-request Ky prefix is excluded
    client.get("/csv", { prefix: "https://other.test" });
    // @ts-expect-error status-throwing requests do not expose result
    client.get("/csv").throwOnStatus().result();

    type Data<R> = R extends { json(): Promise<infer T> } ? T : never;
    const _assertions: [
        Assert<
            Equal<
                Data<ReturnType<typeof client.get<"/things/{id}">>>,
                { id: string }
            >
        >,
        Assert<
            Equal<
                Data<ReturnType<typeof client.delete<"/things/{id}">>>,
                undefined
            >
        >,
        Assert<
            Equal<
                Data<ReturnType<typeof client.get<"/mixed">>>,
                { id: string } | undefined
            >
        >,
    ] = [true, true, true];

    client
        .get("/things/{id}", thing)
        .result()
        .then(([error]) => {
            if (error instanceof HTTPError) {
                const documented: { message: string } | string | undefined =
                    error.data;
                // @ts-expect-error JSON error body is not numeric
                const incorrect: number = error.data;
                return [documented, incorrect];
            }
        });
}

const mockFetch = (
    fn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) => Object.assign(fn, { preconnect: () => {} });
const fetchClient = (
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) =>
    createFetchClient<Paths>({
        prefix: "https://example.test/v1/",
        headers: { Authorization: "Bearer secret" },
        fetch: mockFetch(fetch),
    });
const thing = { params: { id: "1" }, query: { required: "x" } };

describe("fetch client", () => {
    test("encodes paths, repeats query arrays, omits nulls and merges headers", async () => {
        let request!: Request;
        const client = fetchClient(async (input) => {
            request = input as Request;
            return Response.json({ id: "a" });
        });
        await client
            .get("/things/{id}", {
                params: { id: "a b/" },
                query: { required: "yes", years: [1, 2], omit: null },
                headers: { "X-Local": "yes" },
            })
            .raw();
        expect(request.url).toBe(
            "https://example.test/v1/things/a%20b%2F?required=yes&years=1&years=2",
        );
        expect(request.headers.get("authorization")).toBe("Bearer secret");
        expect(request.headers.get("x-local")).toBe("yes");
        await client
            .get("/repeat/{id}/related/{id}", { params: { id: "a/b" } })
            .raw();
        expect(request.url).toBe(
            "https://example.test/v1/repeat/a%2Fb/related/a%2Fb",
        );
    });

    test("sends JSON bodies and FormData uploads", async () => {
        const captured: Request[] = [];
        const client = fetchClient(async (input) => {
            captured.push((input as Request).clone());
            return Response.json({ id: "a" }, { status: 201 });
        });
        await client
            .post("/things/{id}", { params: { id: "1" }, body: { name: "n" } })
            .raw();
        const form = new FormData();
        form.set("file", "contents");
        await client.post("/api/assets", { body: form }).raw();
        expect(captured[0]?.headers.get("content-type")).toContain(
            "application/json",
        );
        expect(await captured[0]?.json()).toEqual({ name: "n" });
        expect(captured[1]?.headers.get("content-type")).toContain(
            "multipart/form-data; boundary=",
        );
        expect((await captured[1]?.formData())?.get("file")).toBe("contents");
    });

    test("parses JSON, returns undefined for 204 and fails on non-JSON", async () => {
        const json = fetchClient(async () => Response.json({ id: "ok" }));
        expect(await json.get("/things/{id}", thing).json()).toEqual({
            id: "ok",
        });
        const empty = fetchClient(
            async () => new Response(null, { status: 204 }),
        );
        expect(await empty.get("/mixed").result()).toEqual([null, undefined]);
        const csv = fetchClient(async () => new Response("a,b"));
        expect(
            await csv
                .get("/csv")
                .raw()
                .then((r) => r.text()),
        ).toBe("a,b");
        const [error] = await csv.get("/csv").result();
        expect(error).toBeInstanceOf(FetchError);
    });

    test("uses Ky hooks and JSON parsers", async () => {
        const calls: string[] = [];
        const client = createFetchClient<Paths>({
            prefix: "https://example.test",
            parseJson: (text) => ({ id: JSON.parse(text).id + "-parsed" }),
            hooks: { beforeRequest: [() => void calls.push("client")] },
            fetch: mockFetch(async () => Response.json({ id: "ok" })),
        });
        const data = await client
            .get("/things/{id}", {
                ...thing,
                hooks: { beforeRequest: [() => void calls.push("request")] },
            })
            .json();
        expect(data).toEqual({ id: "ok-parsed" });
        expect(calls).toEqual(["client", "request"]);
    });

    test("normalizes failures and preserves raw HTTP error bodies", async () => {
        const client = fetchClient(async () =>
            Response.json({ message: "bad" }, { status: 400 }),
        );
        const response = await client.get("/things/{id}", thing).raw();
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ message: "bad" });
        const [error, data] = await client.get("/things/{id}", thing).result();
        expect(error).toBeInstanceOf(HTTPError);
        expect(error instanceof HTTPError && error.data).toEqual({
            message: "bad",
        });
        expect(data).toBeNull();
        await expect(
            client.get("/things/{id}", thing).throwOnStatus().raw(),
        ).rejects.toBeInstanceOf(HTTPError);
        const offline = fetchClient(async () => {
            throw "offline";
        });
        const [failure] = await offline.get("/csv", { retry: 0 }).result();
        expect(failure).toBeInstanceOf(FetchError);
        expect(failure?.cause).toBe("offline");
    });

    test("is single use and rejects missing path parameters", async () => {
        let calls = 0;
        const client = fetchClient(async () => {
            calls++;
            return Response.json({ id: "ok" });
        });
        const request = client.get("/things/{id}", thing);
        await request.raw();
        await expect(request.json()).rejects.toThrow("already been consumed");
        const [error] = await client
            .get("/things/{id}", {
                params: { id: undefined as unknown as string },
                query: { required: "x" },
            })
            .result();
        expect(error?.message).toContain("Missing path parameter");
        expect(calls).toBe(1);
    });
});
