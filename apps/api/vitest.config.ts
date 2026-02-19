import path from "node:path";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode ?? "test", path.resolve(__dirname, "../.."), "");

    return {
        test: {
            coverage: {
                provider: "v8",
            },
            fileParallelism: true,
            sequence: {
                concurrent: false,
            },
            maxWorkers: env.MAX_TEST_WORKERS ? Number(env.MAX_TEST_WORKERS) : 1,
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
    };
});
