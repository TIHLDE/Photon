import { $ } from "bun";

type PullRequest = { number: number; title: string; body: string | null };
type Section = "Nytt" | "Forbedret" | "Fikset";

const releaseTagPattern = /^(\d{4}-\d{2}-\d{2})\.release-(\d+)$/;
const sections: Section[] = ["Nytt", "Forbedret", "Fikset"];
const sectionByType: Record<string, Section> = {
    feat: "Nytt",
    perf: "Forbedret",
    fix: "Fikset",
};

const tag = Bun.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!tag || !releaseTagPattern.test(tag)) {
    console.error("Usage: bun scripts/release-notes.ts <YYYY-MM-DD.release-N>");
    process.exit(1);
}

function releaseOrder(a: string, b: string): number {
    const [, dateA, numberA] = a.match(releaseTagPattern)!;
    const [, dateB, numberB] = b.match(releaseTagPattern)!;
    return dateA!.localeCompare(dateB!) || Number(numberA) - Number(numberB);
}

const previousTag = (await $`git tag --list`.text())
    .split("\n")
    .filter((name) => releaseTagPattern.test(name))
    .filter((name) => releaseOrder(name, tag) < 0)
    .sort(releaseOrder)
    .at(-1);

const repo = (
    await $`gh repo view --json nameWithOwner -q .nameWithOwner`.text()
).trim();

const generatedNotes: string = (
    await $`gh api repos/${repo}/releases/generate-notes -f tag_name=${tag} ${
        previousTag ? ["-f", `previous_tag_name=${previousTag}`] : []
    }`.json()
).body;

const prNumbers = [
    ...new Set(
        [...generatedNotes.matchAll(/\/pull\/(\d+)/g)].map((match) =>
            Number(match[1]),
        ),
    ),
];

const pullRequests: PullRequest[] = await Promise.all(
    prNumbers.map(
        async (number) =>
            await $`gh pr view ${number} --json number,title,body`.json(),
    ),
);

function memberNotes(body: string | null): string[] {
    const lines = (
        body
            ?.replace(/<!--[\s\S]*?-->/g, "")
            .match(
                /^##\s*For medlemmer\s*$([\s\S]*?)(?=^#{1,2}\s|(?![\s\S]))/im,
            )?.[1] ?? ""
    )
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const notes: string[] = [];
    for (const line of lines) {
        const bullet = line.match(/^[-*]\s+(.*)$/)?.[1];
        if (bullet !== undefined || notes.length === 0) {
            notes.push(bullet ?? line);
        } else {
            notes[notes.length - 1] += ` ${line}`;
        }
    }
    return notes;
}

function conventionalType(title: string): string | undefined {
    return title.match(/^(\w+)(?:\([^)]*\))?!?:/)?.[1]?.toLowerCase();
}

function withoutPrefix(title: string): string {
    const text = title.replace(/^\w+(?:\([^)]*\))?!?:\s*/, "");
    return text.charAt(0).toUpperCase() + text.slice(1);
}

const entries = new Map<Section, string[]>(sections.map((s) => [s, []]));

for (const { number, title, body } of pullRequests) {
    const notes = memberNotes(body);
    if (notes.length === 1 && /^[-–—]$/.test(notes[0]!)) continue;

    const section = sectionByType[conventionalType(title) ?? ""];
    if (notes.length > 0) {
        for (const note of notes) {
            entries.get(section ?? "Forbedret")!.push(`${note} (#${number})`);
        }
    } else if (section) {
        entries.get(section)!.push(`${withoutPrefix(title)} (#${number})`);
    }
}

const summary = sections
    .filter((section) => entries.get(section)!.length > 0)
    .map(
        (section) =>
            `### ${section}\n\n${entries
                .get(section)!
                .map((entry) => `- ${entry}`)
                .join("\n")}`,
    )
    .join("\n\n");

console.log(
    `${summary || "Ingen synlige endringer denne gangen – bare vedlikehold bak kulissene."}\n\n<details>\n<summary>Tekniske detaljer</summary>\n\n${generatedNotes}\n\n</details>`,
);
