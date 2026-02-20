import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function checkVersion() {
    const pkg = JSON.parse(
        readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
    );
    const installed = pkg.version;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const res = await fetch(
            `https://registry.npmjs.org/${pkg.name}/latest`,
            { signal: controller.signal },
        );
        const latest = (await res.json()).version;

        if (installed !== latest) {
            console.warn(
                `\x1b[33m[@tihlde/sdk] Update available: ${installed} → ${latest}\x1b[0m`,
            );
            console.warn(
                `\x1b[33mRun \`bun add @tihlde/sdk@latest\` to update.\x1b[0m`,
            );
        }
    } catch {
        // Silently ignore — never block installation
    } finally {
        clearTimeout(timeout);
    }
}

checkVersion();
