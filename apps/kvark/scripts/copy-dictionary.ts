/**
 * Legg den norske ordboka ut som statisk fil.
 *
 * `dictionary-nb` leser filene sine med `node:fs` og sperrer for direkte
 * import av dem, så de kan ikke hentes gjennom bundleren. I stedet kopieres de
 * hit før dev og build, og stavekontrollen henter dem med `fetch` når noen
 * åpner en editor. Filene er store og uforanderlige, så de ligger i
 * `.gitignore` i stedet for i repoet.
 */
import { createRequire } from "node:module";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * `.txt`-endelsen er med vilje: filene serveres da som `text/plain`, og både
 * Vercel og vanlige webservere komprimerer den typen automatisk. Ordboka går
 * fra 5,3 MB til rundt 1,4 MB over nett. Med `.dic` ville den blitt sendt som
 * ukjent binærtype, altså ukomprimert.
 */
const FILES = [
    { from: "index.aff", to: "index.aff.txt" },
    { from: "index.dic", to: "index.dic.txt" },
];
const TARGET_DIR = join(
    import.meta.dirname,
    "..",
    "public",
    "dictionaries",
    "nb",
);

const require = createRequire(import.meta.url);
// Pakken eksporterer bare inngangspunktet sitt, men ordbokfilene ligger ved
// siden av det.
const sourceDir = dirname(require.resolve("dictionary-nb"));

await mkdir(TARGET_DIR, { recursive: true });

for (const file of FILES) {
    const from = join(sourceDir, file.from);
    const to = join(TARGET_DIR, file.to);

    // Ordboka endrer seg bare når pakken oppgraderes, så vi hopper over
    // kopieringen når filen allerede ligger der i riktig størrelse.
    const [source, existing] = await Promise.all([
        stat(from),
        stat(to).catch(() => null),
    ]);
    if (existing && existing.size === source.size) continue;

    await copyFile(from, to);
    console.log(`ordbok: ${file.to} (${Math.round(source.size / 1024)} kB)`);
}
