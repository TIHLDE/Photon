import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const authPackageDir = resolve(scriptDir, "..");
const repoRoot = resolve(authPackageDir, "../..");

const pgCoreImport =
    /^import\s*{([^}]*)}\s*from\s*["']drizzle-orm\/pg-core["'];/m;
const pgTableFactory =
    "const pgTable = pgTableCreator((name) => `auth_${name}`);";

const outputPath = resolve(authPackageDir, "../db/src/schema/auth.ts");
const cliOutputPath = relative(authPackageDir, outputPath);

await mkdir(dirname(outputPath), { recursive: true });
await run(
    "bunx",
    [
        "--bun",
        "auth@latest",
        "generate",
        "-y",
        "--config",
        "./src/cli-auth-instance.ts",
        "--output",
        cliOutputPath,
    ],
    { cwd: authPackageDir },
);

const generatedSchema = await readFile(outputPath, "utf8");
await writeFile(outputPath, addAuthTablePrefix(generatedSchema));

await run("bunx", ["oxfmt", outputPath], { cwd: repoRoot });

function addAuthTablePrefix(source: string) {
    const importMatch = source.match(pgCoreImport);

    if (!importMatch) {
        throw new Error('Could not find the "drizzle-orm/pg-core" import.');
    }

    const importedSpecifiers = importMatch[1];

    if (!importedSpecifiers) {
        throw new Error('Could not read the "drizzle-orm/pg-core" import.');
    }

    const specifiers = importedSpecifiers
        .split(",")
        .map((specifier) => specifier.trim())
        .filter((specifier) => specifier.length > 0 && specifier !== "pgTable");

    if (!specifiers.includes("pgTableCreator")) {
        specifiers.push("pgTableCreator");
    }

    let updated = source.replace(
        pgCoreImport,
        [
            "import {",
            ...specifiers.map((specifier) => `    ${specifier},`),
            '} from "drizzle-orm/pg-core";',
        ].join("\n"),
    );

    if (updated.includes(pgTableFactory)) {
        return updated;
    }

    const importBlock = updated.match(/^(?:import[\s\S]*?;\n)+/);

    if (!importBlock) {
        throw new Error("Could not find the import block.");
    }

    return [
        importBlock[0],
        pgTableFactory,
        "",
        updated.slice(importBlock[0].length),
    ].join("\n");
}

function run(command: string, args: string[], options: { cwd: string }) {
    return new Promise<void>((resolveCommand, rejectCommand) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            stdio: "inherit",
        });

        child.on("error", rejectCommand);
        child.on("exit", (code, signal) => {
            if (code === 0) {
                resolveCommand();
                return;
            }

            rejectCommand(
                new Error(
                    `${command} ${args.join(" ")} failed with ${
                        signal ? `signal ${signal}` : `exit code ${code}`
                    }.`,
                ),
            );
        });
    });
}
