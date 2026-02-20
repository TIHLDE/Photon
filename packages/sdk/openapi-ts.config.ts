import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
    input: "./openapi.json",
    output: { path: "src/generated" },
    plugins: [
        { dates: true, name: "@hey-api/transformers" },
        { name: "@hey-api/sdk", transformer: true },
        { name: "@hey-api/client-fetch", throwOnError: true },
    ],
});
