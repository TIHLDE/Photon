import { describe, expect, test } from "vitest";
import { z } from "zod";

import {
    type DirectiveDefinition,
    type DirectiveRegistry,
    defineDirective,
} from "../directive";
import { mdastToTiptap } from "./mdast-to-pm";
import { parseMarkdown, stringifyMdast } from "./pipeline";
import { tiptapToMdast } from "./pm-to-mdast";

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
