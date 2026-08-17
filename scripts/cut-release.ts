import assert from "node:assert";
import { $ } from "bun";

type Release = { tagName: string };

const dryRun = Bun.argv.includes("--dry-run");

async function $trim(
    strings: TemplateStringsArray,
    ...expressions: Bun.ShellExpression[]
): Promise<string> {
    return (await $(strings, ...expressions).text()).trim();
}
async function confirm(message: string) {
    process.stdout.write(`${message} [y/N]: `);
    for await (const line of console) {
        return line.toLowerCase().trim() == "y";
    }
}

const branch = await $trim`git branch --show-current`;
assert.equal(branch, "main", "Must be on main; do: `git switch main`");

const isWorkingTreeClean = (await $trim`git status --porcelain`).length === 0;
assert.ok(isWorkingTreeClean, "You have uncommitted changes");

await $`git fetch origin main --tags --quiet`;

const commit = await $trim`git rev-parse HEAD`;
const originCommit = await $trim`git rev-parse origin/main`;
assert.equal(commit, originCommit, "main is not up to date; do: `git pull`");

const releases: Release[] =
    await $`gh release list --limit 10 --json tagName`.json();

const date = new Date().toISOString().slice(0, 10);

const releasePattern = new RegExp(`^${date}\\.release-(\\d+)$`);

const todayNumbers = releases
    .map(({ tagName }) => tagName.match(releasePattern)?.[1])
    .filter((number): number is string => number !== undefined)
    .map(Number);

const tag = `${date}.release-${Math.max(0, ...todayNumbers) + 1}`;

const previousTag = releases
    .map(({ tagName }) => tagName)
    .filter((tagName) => /^\d{4}-\d{2}-\d{2}\.release-\d+$/.test(tagName))
    .sort()
    .at(-1);

console.log(`Release: ${tag}`);
console.log(`Commit:  ${commit.slice(0, 7)}`);
if (previousTag) {
    console.log(`Changes since ${previousTag}:`);
    console.log(await $trim`git log --oneline ${previousTag}..HEAD`);
}

if (dryRun) {
    console.log("Dry run: nothing was tagged or pushed.");
    process.exit(0);
}

assert.ok(await confirm("This deploys to production. Continue?"), "Cancelled");

await $`git tag -a ${tag} -m ${`Release ${tag}`}`;
await $`git push origin ${tag}`;
console.log(`Pushed ${tag}. Follow it with: gh run list --limit 3`);
