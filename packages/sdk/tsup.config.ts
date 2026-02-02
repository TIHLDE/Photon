import { defineConfig } from "tsup";

export default defineConfig({
    entry: [
        "src/index.ts",
        "src/api/index.ts",
        "src/auth/index.ts",
        "src/types/index.ts",
    ],
    format: ["esm"],
    target: "es2022",
    outDir: "dist",
    clean: true,
    sourcemap: true,
    dts: true,
    splitting: false,
    treeshake: true,
});
