import path from "node:path";
import { defineConfig } from "vitest/config";
import { env } from "./src/lib/env";

export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
        },
        fileParallelism: true,
        sequence: {
            concurrent: false,
        },
        maxWorkers: env.MAX_TEST_WORKERS, // 2 containers per worker
        maxConcurrency: 1,
    },
    resolve: {
        alias: {
            "~": path.resolve(__dirname, "./src"),
        },
    },
});
