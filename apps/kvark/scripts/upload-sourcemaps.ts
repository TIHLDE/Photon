/**
 * Last opp source maps til PostHog så stack traces peker på kildekoden i
 * stedet for minifisert output.
 *
 * Kjøres etter `vite build`. Uten `POSTHOG_CLI_API_KEY` og
 * `POSTHOG_CLI_PROJECT_ID` hopper den over i stillhet — lokale bygg og
 * PR-sjekker skal ikke feile på en manglende hemmelighet.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Nitro skriver til `.vercel/output/static` med Vercel-presetet og til
 * `.output/public` ellers. Begge er i bruk: det første på deploy, det andre
 * når noen bygger lokalt.
 */
const OUTPUT_DIRS = [
    join(import.meta.dir, "..", ".vercel", "output", "static"),
    join(import.meta.dir, "..", ".output", "public"),
];

const apiKey = process.env.POSTHOG_CLI_API_KEY;
const projectId = process.env.POSTHOG_CLI_PROJECT_ID;

if (!apiKey || !projectId) {
    console.log(
        "[sourcemaps] POSTHOG_CLI_API_KEY/POSTHOG_CLI_PROJECT_ID mangler — hopper over opplasting.",
    );
    process.exit(0);
}

// Et tidligere bygg med det andre presetet kan ha lagt igjen en katalog uten
// kart. Den vi vil ha er den som faktisk inneholder dem.
const outputDir = OUTPUT_DIRS.find(
    (dir) =>
        existsSync(dir) &&
        readdirSync(dir, { recursive: true }).some(
            (entry) => typeof entry === "string" && entry.endsWith(".map"),
        ),
);

if (!outputDir) {
    console.log(
        "[sourcemaps] Fant ingen source maps i byggeoutput — hopper over.",
    );
    process.exit(0);
}

const result = Bun.spawnSync(
    ["bunx", "@posthog/cli", "sourcemap", "process", "--directory", outputDir],
    {
        stdout: "inherit",
        stderr: "inherit",
        env: {
            ...process.env,
            POSTHOG_CLI_HOST:
                process.env.POSTHOG_CLI_HOST ?? "https://eu.posthog.com",
        },
    },
);

/**
 * Feiler opplastingen, skal deployen likevel gå. Source maps gjør stack traces
 * lesbare, men en nedetid hos PostHog eller en rullert nøkkel er ingen grunn
 * til å blokkere en utrulling av tihlde.org.
 */
if (result.exitCode !== 0) {
    console.error(
        "[sourcemaps] Opplasting feilet — bygget fortsetter, men stack traces i PostHog blir uleselige til neste vellykkede deploy.",
    );
}
