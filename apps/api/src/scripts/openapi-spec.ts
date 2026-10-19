/**
 * Writes the API's OpenAPI document to a file, without a database or any
 * other service behind it — the spec is built from the route definitions.
 *
 * Used by `@photon/codegen`. It writes to a file rather than stdout because
 * the request logger prints to stdout.
 *
 * ### Usage
 *
 *     bun run src/scripts/openapi-spec.ts <output.json>
 */
import { writeFile } from "node:fs/promises";
import { createApp } from "~/app";
import type { AppContext, AppServices } from "~/lib/ctx";

const [outputPath] = process.argv.slice(2);
if (!outputPath) {
    throw new Error("Usage: bun run src/scripts/openapi-spec.ts <output.json>");
}

const app = await createApp({
    ctx: {} as AppContext,
    service: {} as AppServices,
});

const response = await app.request("/openapi");
if (!response.ok) {
    throw new Error(
        `Failed to build OpenAPI spec: ${response.status}\n${await response.text()}`,
    );
}

await writeFile(outputPath, await response.text());
