import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        auth: "src/auth.ts",
    },
    format: ["esm"],
    dts: true,
    target: "es2022",
    external: ["better-auth"],
});
