# Photon API code generation

`photon-codegen` exports the API’s OpenAPI document directly from its route definitions, then runs `typed-openapi`. No running API or database is required.

- Kvark: `cd apps/kvark && bun run codegen`
- From the repository root: `bun run codegen`
- Request regression check: `cd apps/kvark && bun run test`

All generated API code lives in `packages/codegen/src/generated` and is exported by `@photon/codegen`. Kvark consumes this single copy; no generated API files live in Kvark. Commit the generated files. `openapi.ts` contains the client, endpoint types, and `Schemas` namespace; `api.client.ts` is the upstream-generated native Fetch transport. `schemas.ts` keeps convenient named schema aliases. `index.ts` exports these plus query/body type helpers. Do not edit generated files.

```ts
import { createApi } from "@photon/codegen";

const api = createApi("https://photon.tihlde.org");
const event = await api.get("/api/event/{eventId}", {
    path: { eventId: "123" },
});
```

Calls return parsed data and throw `TypedStatusError` for HTTP 400–599. Use `withResponse: true` for a discriminated status/data result. Network failures still throw. Use `path`, `query`, and `body` instead of the previous `params`, `searchParams`, and `json`; native request options belong in `overrides`. Multipart bodies are typed objects containing a `File`/`Blob`; the generated fetcher builds `FormData` and sets the boundary.

Kvark adds only per-request SSR cookie forwarding, browser credentials, and user-facing API error messages in `src/api/api-client.ts`. The transport uses native Fetch: Ky-specific hooks, automatic retries, and timeouts are not retained. Use native `overrides.signal` for cancellation or an explicit timeout. Runtime schema validation is not enabled.
