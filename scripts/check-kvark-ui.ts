import { $ } from "bun";

/**
 * Fails on Tailwind colour, typography or decoration classes added to
 * apps/kvark — that styling belongs in @tihlde/ui (see apps/kvark/AGENTS.md).
 *
 * Only lines added relative to main are checked: kvark carries hundreds of
 * older violations, and failing on those would make the check useless.
 *
 *   bun scripts/check-kvark-ui.ts                 working tree vs merge-base with origin/main
 *   bun scripts/check-kvark-ui.ts --base <sha>    working tree vs <sha> (CI)
 *   bun scripts/check-kvark-ui.ts --hook          Claude PostToolUse hook, reads the edited file from stdin
 */

const ROOT = "apps/kvark/src/";
const ALLOW_MARKER = "ui-allow";

const FORBIDDEN = [
    /^text-(xs|sm|base|lg|xl|[2-9]xl)$/,
    /^text-(?!(left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$)[a-z[]/,
    /^bg-/,
    /^border(-|$)/,
    /^rounded(-|$)/,
    /^shadow(-|$)/,
    /^ring(-|$)/,
    /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|sans|serif|mono)$/,
    /^leading-/,
    /^tracking-/,
];

type Violation = { file: string; line: number; token: string; text: string };

function forbiddenTokens(line: string): string[] {
    return line
        .split(/[\s"'`{}(),;]+/)
        .map((token) => token.split(":").pop()?.replace(/^!/, "") ?? "")
        .filter((token) => FORBIDDEN.some((pattern) => pattern.test(token)));
}

// Comments often name a class while explaining it, and prose like "text-like"
// would otherwise match.
function isComment(line: string): boolean {
    return /^\s*(\/\/|\/\*|\*|\{\/\*)/.test(line);
}

function checkLines(
    file: string,
    lines: Array<{ line: number; text: string }>,
): Violation[] {
    return lines.flatMap(({ line, text }) =>
        text.includes(ALLOW_MARKER) || isComment(text)
            ? []
            : forbiddenTokens(text).map((token) => ({
                  file,
                  line,
                  token,
                  text: text.trim(),
              })),
    );
}

function isChecked(file: string): boolean {
    return file.startsWith(ROOT) && /\.(tsx?|jsx?)$/.test(file);
}

async function resolveBase(explicit: string | undefined): Promise<string> {
    if (explicit) return explicit;
    const mergeBase = await $`git merge-base HEAD origin/main`
        .nothrow()
        .quiet();
    return mergeBase.exitCode === 0 ? mergeBase.text().trim() : "HEAD";
}

async function addedLines(
    base: string,
    paths: string[],
): Promise<Map<string, Array<{ line: number; text: string }>>> {
    const diff = await $`git diff --no-color --unified=0 ${base} -- ${paths}`
        .quiet()
        .text();

    const result = new Map<string, Array<{ line: number; text: string }>>();
    let file: string | null = null;
    let next = 0;

    for (const raw of diff.split("\n")) {
        if (raw.startsWith("+++ ")) {
            file = raw === "+++ /dev/null" ? null : raw.slice(6);
            continue;
        }
        const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunk) {
            next = Number(hunk[1]);
            continue;
        }
        if (file && raw.startsWith("+")) {
            const lines = result.get(file) ?? [];
            lines.push({ line: next, text: raw.slice(1) });
            result.set(file, lines);
            next++;
        }
    }

    // `git diff` never shows untracked files, and a brand-new component is
    // exactly where new styling tends to appear.
    const untracked = (
        await $`git ls-files --others --exclude-standard -- ${paths}`
            .quiet()
            .text()
    )
        .split("\n")
        .filter(Boolean);

    for (const path of untracked) {
        const text = await Bun.file(path).text();
        result.set(
            path,
            text
                .split("\n")
                .map((line, index) => ({ line: index + 1, text: line })),
        );
    }

    return result;
}

async function readHookFile(): Promise<string | null> {
    const input = (await Bun.stdin.json()) as {
        tool_input?: { file_path?: string };
    };
    const filePath = input.tool_input?.file_path;
    if (!filePath) return null;

    const root = process.cwd();
    return filePath.startsWith(`${root}/`)
        ? filePath.slice(root.length + 1)
        : filePath;
}

process.chdir(`${import.meta.dir}/..`);

const args = Bun.argv.slice(2);
const isHook = args.includes("--hook");
const baseIndex = args.indexOf("--base");
const base = await resolveBase(
    baseIndex === -1 ? undefined : args[baseIndex + 1],
);

let paths = [ROOT];
if (isHook) {
    const file = await readHookFile();
    if (!file || !isChecked(file)) process.exit(0);
    paths = [file];
}

const violations = [...(await addedLines(base, paths))]
    .filter(([file]) => isChecked(file))
    .flatMap(([file, lines]) => checkLines(file, lines));

if (violations.length === 0) {
    if (!isHook)
        console.log("No new styling outside @tihlde/ui in apps/kvark.");
    process.exit(0);
}

const report = [
    `Found ${violations.length} Tailwind class(es) in apps/kvark that belong in @tihlde/ui:`,
    ...violations.map((v) => `  ${v.file}:${v.line}  ${v.token}    ${v.text}`),
    "",
    "Tailwind in kvark is layout only. Use a @tihlde/ui component, or add a variant to packages/ui.",
    `If a line truly needs it, add a \`${ALLOW_MARKER}: <reason>\` comment on that line.`,
].join("\n");

console.error(report);
// Exit code 2 is what makes Claude Code hand stderr back to the model.
process.exit(isHook ? 2 : 1);
