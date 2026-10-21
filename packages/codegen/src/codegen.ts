import { generateClientFiles } from "typed-openapi/node";
import { mapOpenApiEndpoints } from "typed-openapi";

async function openApiCodegen(output: unknown) {
    const context = mapOpenApiEndpoints(output);
    await generateClientFiles(specPath, {
        output: join(outDir, "openapi.ts"),
        runtime: "none",
        defaultFetcher: { clientPath: "./openapi" },
        format: true,
        // Proxies and middleware can return statuses absent from individual routes.
        errorStatusCodes: Array.from({ length: 200 }, (_, i) => 400 + i).join(
            ",",
        ),
    });
}
