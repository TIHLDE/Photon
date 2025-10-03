import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
        },
        fileParallelism: true,
        sequence: {
            concurrent: false,
        },
        maxConcurrency: 1, // 2 containers per concurrent task
    },
    resolve: {
        alias: {
            "~": path.resolve(__dirname, "./src"),
        },
    },
});
