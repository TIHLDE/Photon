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
        maxWorkers: process.env.MAX_TEST_WORKERS
            ? Number(process.env.MAX_TEST_WORKERS)
            : 1,
        maxConcurrency: 1,
        server: {
            deps: {
                inline: [/@photon\//],
            },
        },
    },
    resolve: {
        alias: {
            "~": path.resolve(__dirname, "./src"),
        },
    },
});
