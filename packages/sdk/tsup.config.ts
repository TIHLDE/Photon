import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        auth: "src/auth.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    splitting: true,
    clean: true,
    outDir: "dist",
});
