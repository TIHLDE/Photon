import Anthropic from "@anthropic-ai/sdk";
import { $ } from "bun";

type PullRequest = { number: number; title: string; body: string };

const releaseTagPattern = /^\d{4}-\d{2}-\d{2}\.release-\d+$/;

const tag = Bun.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!tag || !releaseTagPattern.test(tag)) {
    console.error("Usage: bun scripts/release-notes.ts <YYYY-MM-DD.release-N>");
    process.exit(1);
}

const tags = (await $`git tag --list`.text())
    .split("\n")
    .filter((name) => releaseTagPattern.test(name))
    .sort();
const previousTag = tags.filter((name) => name < tag).at(-1);

const repo = (
    await $`gh repo view --json nameWithOwner -q .nameWithOwner`.text()
).trim();

const generatedNotes: string = (
    await $`gh api repos/${repo}/releases/generate-notes -f tag_name=${tag} ${
        previousTag ? ["-f", `previous_tag_name=${previousTag}`] : []
    }`.json()
).body;

const range = previousTag ? `${previousTag}..${tag}` : tag;
const prNumbers = [
    ...(await $`git log --format=%s ${range}`.text()).matchAll(/\(#(\d+)\)$/gm),
].map((match) => Number(match[1]));

const pullRequests: PullRequest[] = await Promise.all(
    prNumbers.map(
        async (number) =>
            await $`gh pr view ${number} --json number,title,body`.json(),
    ),
);

const instructions = `Du skriver release notes for TIHLDEs nettside (tihlde.org) og app. Leserne er vanlige studenter og medlemmer, ikke utviklere.

Du får en liste med pull requests som er med i denne releasen. Skriv en kort, norsk oppsummering av hva som er endret for brukerne.

Regler:
- Skriv på enkel norsk (bokmål) som alle forstår. Ingen tekniske ord som API, endepunkt, migrasjon, database, komponent, refaktorering eller CI.
- Forklar hva brukeren nå kan gjøre, eller hva som oppfører seg annerledes, og hvor på siden det skjer. Ikke forklar hvordan det er laget.
- Del inn i disse seksjonene, og dropp seksjoner som blir tomme: "### Nytt", "### Forbedret", "### Fikset".
- Ett punkt per endring, én eller to setninger. Avslutt hvert punkt med PR-nummeret i parentes, f.eks. (#899). Slå sammen PR-er som handler om det samme til ett punkt med flere numre.
- Hopp over endringer som ikke merkes for brukerne: vedlikehold, opprydding, avhengigheter, tester, bygg og intern infrastruktur.
- Hvis ingenting merkes for brukerne, skriv bare: "Ingen synlige endringer denne gangen – bare vedlikehold bak kulissene."
- Nevn aldri navn, brukernavn, e-postadresser eller andre personopplysninger, selv om de står i PR-ene.
- Ikke skriv overskrift, innledning eller avslutning. Start rett på første seksjon.`;

const pullRequestText = pullRequests
    .map(
        ({ number, title, body }) =>
            `<pr number="${number}">\nTittel: ${title}\n\n${(body ?? "").slice(0, 4000)}\n</pr>`,
    )
    .join("\n\n");

async function summarize(): Promise<string | undefined> {
    if (pullRequests.length === 0) return undefined;
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error(
            "ANTHROPIC_API_KEY is not set; using GitHub's notes only",
        );
        return undefined;
    }

    try {
        const response = await new Anthropic().beta.messages.create({
            model: "claude-opus-5-5",
            max_tokens: 16000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            system: instructions,
            messages: [{ role: "user", content: pullRequestText }],
        });

        if (response.stop_reason !== "end_turn") {
            console.error(`Claude stopped with ${response.stop_reason}`);
            return undefined;
        }

        const text = response.content
            .flatMap((block) => (block.type === "text" ? [block.text] : []))
            .join("")
            .trim();
        return text || undefined;
    } catch (error) {
        console.error("Could not summarize the release with Claude:", error);
        return undefined;
    }
}

const summary = await summarize();

console.log(
    summary
        ? `${summary}\n\n<details>\n<summary>Tekniske detaljer</summary>\n\n${generatedNotes}\n\n</details>`
        : generatedNotes,
);
