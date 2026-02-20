import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { config } from "@dotenvx/dotenvx";
import alchemy from "alchemy";
import { Worker } from "alchemy/cloudflare";

// Load root .env (same pattern as @photon/core/env)
let dir = resolve(".");
while (true) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
        config({ path: candidate, quiet: true });
        break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
}

const app = await alchemy("photon-email-proxy", {
    password: process.env.ALCHEMY_PASSWORD,
});

const worker = await Worker("photon-email-proxy", {
    entrypoint: "./src/index.ts",
    url: true,
    compatibilityFlags: ["nodejs_compat"],
    bindings: {
        EMAIL_PROXY_KEY: alchemy.secret(
            process.env.EMAIL_PROXY_KEY ?? "dev-secret",
        ),
        MAIL_HOST: alchemy.secret(process.env.MAIL_HOST ?? "localhost"),
        MAIL_USER: alchemy.secret(process.env.MAIL_USER ?? ""),
        MAIL_PASS: alchemy.secret(process.env.MAIL_PASS ?? ""),
        MAIL_PORT: process.env.MAIL_PORT ?? "465",
        MAIL_FROM: process.env.MAIL_FROM ?? "no-reply@tihlde.org",
    },
    dev: {
        port: 8787,
    },
});

console.log(`Worker URL: ${worker.url}`);

await app.finalize();
