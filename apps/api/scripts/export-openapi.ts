import { resolve } from "node:path";
import { createApp } from "../src/app";
import type { AppContext, AppServices } from "../src/lib/ctx";

// Pass stub context — the /openapi route only reads route metadata,
// it never executes handlers, so no real DB/Redis/etc. is needed.
const app = await createApp({
    ctx: {} as AppContext,
    service: {} as AppServices,
});

const response = await app.request("/openapi");
if (!response.ok) {
    console.error(`Failed to fetch OpenAPI spec: ${response.status}`);
    console.error(await response.text());
    process.exit(1);
}
const spec = await response.json();

const outPath = resolve(import.meta.dir, "../../../packages/sdk/openapi.json");
await Bun.write(outPath, JSON.stringify(spec, null, 2));

console.log(`OpenAPI spec written to ${outPath}`);
process.exit(0);
