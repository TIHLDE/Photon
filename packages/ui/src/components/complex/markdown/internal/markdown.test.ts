import { describe, expect, test } from "vitest";
import { z } from "zod";

import {
    type DirectiveDefinition,
    type DirectiveRegistry,
    defineDirective,
} from "../directive";
import { unified } from "unified";

import { mdastToTiptap } from "./mdast-to-pm";
import { parseMarkdown, stringifyMdast } from "./pipeline";
import { tiptapToMdast } from "./pm-to-mdast";
import { buildRemarkDirectivePlugin } from "./remark-directive-hast";

// Inline fixtures: a container directive (callout) and a leaf directive (youtube).
// We don't render Edit/Render in tests — only the round-trip through mdast and
// TipTap JSON — so the React components can be no-ops.
const noopRender = () => null;

const calloutFixture = defineDirective({
    name: "callout",
    kind: "container",
    schema: z
        .object({
            type: z
                .enum(["info", "warn", "danger"])
                .catch("info")
                .default("info"),
            title: z.string().optional(),
        })
        .strip(),
    label: "Callout",
    Render: noopRender,
    Edit: noopRender,
});

const youtubeFixture = defineDirective({
    name: "youtube",
    kind: "leaf",
    schema: z.object({ id: z.string().min(1) }),
    label: "YouTube",
    Render: noopRender,
    Edit: noopRender,
});

function makeRegistry(
    directives: ReadonlyArray<DirectiveDefinition>,
): DirectiveRegistry {
    const map = new Map<string, DirectiveDefinition>();
    for (const d of directives) map.set(d.name, d);
    return {
        directives,
        get: (name) => map.get(name),
        has: (name) => map.has(name),
    };
}

const richRegistry = makeRegistry([calloutFixture, youtubeFixture]);
const minimalRegistry = makeRegistry([]);

function roundTrip(markdown: string, registry = richRegistry): string {
    const mdast = parseMarkdown(markdown);
    const tiptap = mdastToTiptap(mdast, registry);
    const mdast2 = tiptapToMdast(tiptap, registry);
    return stringifyMdast(mdast2).trim();
}

function normalize(input: string): string {
    return input.trim().replace(/\s+\n/g, "\n");
}

describe("markdown round-trip", () => {
    test("paragraphs", () => {
        const input = "Hello world.\n\nA second paragraph.";
        expect(normalize(roundTrip(input))).toBe(normalize(input));
    });

    test("headings 1-6", () => {
        const input = [
            "# h1",
            "",
            "## h2",
            "",
            "### h3",
            "",
            "#### h4",
            "",
            "##### h5",
            "",
            "###### h6",
        ].join("\n");
        expect(normalize(roundTrip(input))).toBe(normalize(input));
    });

    test("inline marks: bold, italic, strike, code", () => {
        const input =
            "Mixed **bold** and *italic* and ~~strike~~ and `code` and a [link](https://example.com).";
        const result = roundTrip(input);
        expect(result).toMatch(/\*\*bold\*\*/);
        expect(result).toMatch(/\*italic\*/);
        expect(result).toMatch(/~~strike~~/);
        expect(result).toMatch(/`code`/);
        expect(result).toMatch(/\[link\]\(https:\/\/example\.com\)/);
    });

    test("ordered and unordered lists", () => {
        const input = [
            "- one",
            "- two",
            "- three",
            "",
            "1. first",
            "2. second",
        ].join("\n");
        const result = normalize(roundTrip(input));
        expect(result).toContain("- one");
        expect(result).toContain("- two");
        expect(result).toContain("1. first");
    });

    test("fenced code block preserves language and content", () => {
        const input =
            "```ts\nfunction hello(name: string) {\n    return name;\n}\n```";
        const result = roundTrip(input);
        expect(result).toContain("```ts");
        expect(result).toContain("function hello(name: string)");
    });

    test("blockquote with nested content", () => {
        const input = "> A blockquote\n>\n> with two paragraphs.";
        const result = roundTrip(input);
        expect(result).toMatch(/^> /m);
        expect(result).toContain("A blockquote");
        expect(result).toContain("with two paragraphs.");
    });

    test("gfm table survives round-trip with header and rows", () => {
        const input = [
            "| Method | Path | Description |",
            "| ------ | ---- | ----------- |",
            "| GET | /events | List events |",
            "| POST | /events | Create event |",
        ].join("\n");
        const result = roundTrip(input);
        expect(result).toContain("| Method");
        expect(result).toContain("| GET");
        expect(result).toContain("/events");
        expect(result).toContain("Create event");
    });

    test("thematic break (hr)", () => {
        const input = "before\n\n---\n\nafter";
        const result = roundTrip(input);
        expect(result).toMatch(/before[\s\S]*\*{3}|---|___/);
        expect(result).toContain("after");
    });

    test("container directive (callout) survives round-trip with attrs", () => {
        const input = [
            ':::callout{type="warn" title="Heads up"}',
            "Be careful with this.",
            ":::",
        ].join("\n");
        const result = roundTrip(input);
        expect(result).toContain(":::callout");
        expect(result).toContain("Be careful with this.");
        expect(result).toMatch(/type="?warn"?/);
        expect(result).toMatch(/title="Heads up"/);
    });

    test("leaf directive (youtube) survives round-trip", () => {
        const input = "::youtube{id=dQw4w9WgXcQ}";
        const result = roundTrip(input);
        expect(result).toContain("::youtube");
        // remark-stringify emits `id` using the shorthand `#value` form,
        // which round-trips to the same mdast as `id="value"`.
        expect(result).toMatch(/(?:id="?dQw4w9WgXcQ"?|#dQw4w9WgXcQ)/);

        // Re-parse the output and confirm the id attribute lands intact.
        const reparsed = parseMarkdown(result);
        const directive = reparsed.children[0];
        expect(directive).toBeDefined();
        expect(directive?.type).toBe("leafDirective");
        if (directive?.type === "leafDirective") {
            expect(directive.name).toBe("youtube");
            expect(directive.attributes?.id).toBe("dQw4w9WgXcQ");
        }
    });

    test("unknown directive in registry: minimal registry drops it gracefully", () => {
        // With minimalRegistry, callout isn't registered. Round-trip drops the
        // directive but does not throw or crash.
        const input = ":::callout{type=info}\nBody.\n:::\n\nAfter.";
        expect(() => roundTrip(input, minimalRegistry)).not.toThrow();
    });

    test("standard markdown unchanged when registry is empty", () => {
        const input = "# Title\n\nA paragraph with **bold**.";
        const result = normalize(roundTrip(input, minimalRegistry));
        expect(result).toContain("# Title");
        expect(result).toContain("**bold**");
    });
});

describe("buildRemarkDirectivePlugin", () => {
    function runPlugin(markdown: string, registry = minimalRegistry) {
        const mdast = parseMarkdown(markdown);
        const transform = buildRemarkDirectivePlugin(registry).call(
            unified(),
        ) as (tree: typeof mdast) => void;
        transform(mdast);
        return mdast;
    }

    test("accidental inline directive (time of day) is restored as text", () => {
        // "kl 16:15" parses ":15" as a text directive; the plugin must put
        // the literal text back instead of leaving an unrenderable node.
        const tree = runPlugin("Møtet holdes kl 16:15 hver onsdag.");
        const paragraph = tree.children[0];
        expect(paragraph?.type).toBe("paragraph");
        if (paragraph?.type !== "paragraph") return;
        const text = paragraph.children
            .map((c) => (c.type === "text" ? c.value : ""))
            .join("");
        expect(text).toBe("Møtet holdes kl 16:15 hver onsdag.");
        expect(paragraph.children.some((c) => c.type === "textDirective")).toBe(
            false,
        );
    });

    test("unknown inline directive keeps its label content", () => {
        const tree = runPlugin("Se :info[detaljer her] for mer.");
        const paragraph = tree.children[0];
        if (paragraph?.type !== "paragraph") throw new Error("no paragraph");
        const text = paragraph.children
            .map((c) => (c.type === "text" ? c.value : ""))
            .join("");
        expect(text).toBe("Se :infodetaljer her for mer.");
        expect(
            paragraph.children.some(
                (c) => c.type === "text" && c.value === "detaljer her",
            ),
        ).toBe(true);
    });

    test("registered directives still get hName tagged", () => {
        const tree = runPlugin(
            ":::callout{type=info}\nBody.\n:::",
            richRegistry,
        );
        const directive = tree.children[0];
        expect(directive?.type).toBe("containerDirective");
        if (directive?.type !== "containerDirective") return;
        expect(directive.data?.hName).toBe("tihlde-callout");
    });
});

describe("blanke avsnitt", () => {
    const NBSP = " ";

    test("avsnitt med kun nbsp forsvinner", () => {
        const tree = parseMarkdown(
            `Første avsnitt.\n\n${NBSP}\n\nAndre avsnitt.\n`,
        );
        expect(tree.children).toHaveLength(2);
        expect(tree.children.every((c) => c.type === "paragraph")).toBe(true);
    });

    test("avsnitt med nbsp og ekte tekst beholdes", () => {
        const tree = parseMarkdown(`${NBSP}**VIKTIG**: legg inn allergier\n`);
        expect(tree.children).toHaveLength(1);
        const paragraph = tree.children[0];
        if (paragraph?.type !== "paragraph") throw new Error("no paragraph");
        expect(paragraph.children.length).toBeGreaterThan(0);
    });

    test("blanke avsnitt fjernes også inne i sitatblokker og lister", () => {
        const tree = parseMarkdown(
            `> Sitat.\n>\n> ${NBSP}\n\n- Punkt\n\n  ${NBSP}\n`,
        );
        const quote = tree.children[0];
        if (quote?.type !== "blockquote") throw new Error("no blockquote");
        expect(quote.children).toHaveLength(1);
        const list = tree.children[1];
        if (list?.type !== "list") throw new Error("no list");
        const item = list.children[0];
        expect(item?.children).toHaveLength(1);
    });

    test("editorens TipTap-JSON får ingen tomme avsnitt", () => {
        const doc = mdastToTiptap(
            parseMarkdown(
                `**Dresscode**: studentergalla\n\n${NBSP}\n\nMedbrakt drikke er ikke lov\n`,
            ),
            minimalRegistry,
        );
        expect(doc.content).toHaveLength(2);
        expect(doc.content?.every((node) => node.content?.length)).toBe(true);
    });

    test("vanlig avsnittsskift beholdes", () => {
        const tree = parseMarkdown("Første.\n\nAndre.\n");
        expect(tree.children).toHaveLength(2);
    });
});

describe("enkelt linjeskift", () => {
    test("blir et linjeskift, ikke et mellomrom", () => {
        const tree = parseMarkdown("linje en\nlinje to\n");
        const paragraph = tree.children[0];
        if (paragraph?.type !== "paragraph") throw new Error("no paragraph");
        expect(paragraph.children.map((c) => c.type)).toEqual([
            "text",
            "break",
            "text",
        ]);
    });

    test("overlever turen gjennom editoren", () => {
        const source = "linje en\nlinje to\n";
        const doc = mdastToTiptap(parseMarkdown(source), minimalRegistry);
        const paragraph = doc.content?.[0];
        expect(paragraph?.content?.map((n) => n.type)).toEqual([
            "text",
            "hardBreak",
            "text",
        ]);

        // Lagret markdown normaliseres til CommonMark sitt harde linjeskift.
        // Det parses tilbake til det samme treet, så innholdet er stabilt.
        const saved = stringifyMdast(tiptapToMdast(doc, minimalRegistry));
        expect(saved).toBe("linje en\\\nlinje to\n");
        expect(mdastToTiptap(parseMarkdown(saved), minimalRegistry)).toEqual(
            doc,
        );
    });

    test("linjeskift i en tabellcelle ødelegger ikke tabellen", () => {
        const source = "| a | b |\n| - | - |\n| x | y |\n";
        const doc = mdastToTiptap(parseMarkdown(source), minimalRegistry);
        const saved = stringifyMdast(tiptapToMdast(doc, minimalRegistry));
        expect(parseMarkdown(saved).children[0]?.type).toBe("table");
    });
});
