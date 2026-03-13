import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/types/index.ts", "src/types/auth.ts", "src/auth.ts"],
  outDir: "dist",
  dts: {
    enabled: true,
  },
  deps: {
    alwaysBundle: ["@photon/auth"],
    neverBundle: ["zod"],
  },
  exports: {
    all: true,
    devExports: true,
  },
});
