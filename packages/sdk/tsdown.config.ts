import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/types.ts"],
  outDir: "dist",
  dts: {
    enabled: true,
  },
  exports: {
    all: true,
    devExports: true,
  },
  plugins: [
    {
      name: "openapi-spec-plugin",
      buildStart() {
        const scriptPath = resolve("scripts/generate-openapi.ts");
        execFileSync("bun", ["--bun", "run", scriptPath], {
          stdio: "inherit",
        });
      },
    },
  ],
});
