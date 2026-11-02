import { availableParallelism } from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        setupFiles: ["./src/test/setup-env.ts"],
        coverage: {
            provider: "v8",
        },
        fileParallelism: true,
        // A worker's first integration test also boots its PGlite, which
        // takes several seconds when every core is busy.
        testTimeout: 15_000,
        sequence: {
            concurrent: false,
        },
        // Every worker has its own in-memory database, so files can run in
        // parallel. Half the cores leaves room for the machine; each worker
        // holds roughly 500MB.
        maxWorkers: process.env.MAX_TEST_WORKERS
            ? Number(process.env.MAX_TEST_WORKERS)
            : Math.max(1, Math.floor(availableParallelism() / 2)),
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
