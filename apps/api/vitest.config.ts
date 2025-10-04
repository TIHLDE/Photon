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
        maxWorkers: 1, // 2 containers per worker
        maxConcurrency: 1,
    },
    resolve: {
        alias: {
            "~": path.resolve(__dirname, "./src"),
        },
    },
});
