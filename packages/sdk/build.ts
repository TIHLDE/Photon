// build.mts
import { $ } from "bun"; 

const outDir = "dist";

await $`rm -rf ${outDir}`;

await Bun.build({
    entrypoints: [
        "src/index.ts",
        "src/auth.ts"
    ],
    format: "esm",
    target: "node",
    splitting: true,
    outdir: outDir,
});

await $`bunx tsc --emitDeclarationOnly --outDir ${outDir}`;