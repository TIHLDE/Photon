/**
 * Extracts the resolved `ExtendedSession` type from @photon/auth and writes it
 * as a standalone type to src/generated/session-types.ts.
 *
 * This keeps @photon/auth as the single source of truth while producing a type
 * that has zero workspace-package dependencies — so tsdown's DTS bundler can
 * inline it into the published declaration files.
 */
import { Project, ts } from "ts-morph";
import { resolve } from "node:path";

const SDK_ROOT = resolve(import.meta.dir, "..");
const OUTPUT = resolve(SDK_ROOT, "src/generated/session-types.ts");

const project = new Project({
    tsConfigFilePath: resolve(SDK_ROOT, "tsconfig.json"),
});

const authSource = project.addSourceFileAtPath(
    resolve(SDK_ROOT, "../auth/src/index.ts"),
);
const typeAlias = authSource.getTypeAliasOrThrow("ExtendedSession");

const checker = project.getTypeChecker().compilerObject;
const tsType = typeAlias.getType().compilerType;

const expandedText = checker.typeToString(
    tsType,
    typeAlias.compilerNode,
    ts.TypeFormatFlags.NoTruncation |
        ts.TypeFormatFlags.MultilineObjectLiterals |
        ts.TypeFormatFlags.InTypeAlias,
);

// typeToString doesn't respect MultilineObjectLiterals in practice,
// so we format the output ourselves.
function formatType(raw: string): string {
    let indent = 0;
    let out = "";
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === "[" && raw[i + 1] === "]") {
            out += "[]";
            i++;
        } else if (ch === "{") {
            indent++;
            out += `{\n${"    ".repeat(indent)}`;
            while (raw[i + 1] === " ") i++;
        } else if (ch === "}") {
            indent--;
            out += `\n${"    ".repeat(indent)}}`;
        } else if (ch === ";") {
            out += ";\n";
            while (raw[i + 1] === " ") i++;
            if (raw[i + 1] && raw[i + 1] !== "}") out += "    ".repeat(indent);
        } else {
            out += ch;
        }
    }
    return out;
}

const outputFile = project.createSourceFile(
    OUTPUT,
    [
        "// Auto-generated from @photon/auth — do not edit manually.",
        "// Source of truth: packages/auth/src/index.ts (customSession plugin)",
        "// Regenerate: bun run scripts/generate-session-types.ts",
        "",
        `export type ExtendedSession = ${formatType(expandedText)};`,
        "",
    ].join("\n"),
    { overwrite: true },
);

outputFile.saveSync();

console.log(`Session types written to ${OUTPUT}`);
