import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.ts", "src/templates.ts", "src/schema.ts"],
    outDir: "dist",
    dts: {
        enabled: true,
    },
    exports: {
        all: true,
    },
    format: ["esm"],
    clean: true,
});
