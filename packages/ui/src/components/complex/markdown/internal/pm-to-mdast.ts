import type { JSONContent } from "@tiptap/core";
import type {
    AlignType,
    BlockContent,
    Code,
    Heading,
    Image,
    Link,
    List,
    ListItem,
    Paragraph,
    PhrasingContent,
    Root,
    RootContent,
    Table,
    TableCell,
    TableRow,
} from "mdast";
import type {
    ContainerDirective,
    LeafDirective,
    TextDirective,
} from "mdast-util-directive";

import type { DirectiveRegistry } from "../directive";

type Mark = { type: string; attrs?: Record<string, unknown> };

const MARK_PRIORITY: Record<string, number> = {
    link: 0,
    strike: 1,
    bold: 2,
    italic: 3,
    code: 4,
};

const DIRECTIVE_NODE_PREFIX = "directive-";

/**
 * Convert a TipTap JSON document back to an mdast tree. Standard TipTap
 * nodes have a fixed mapping; nodes whose type starts with `directive-`
 * are converted back into mdast directive nodes using the registry to
 * determine the directive kind (text/leaf/container).
 */
export function tiptapToMdast(
    doc: JSONContent,
    registry: DirectiveRegistry,
): Root {
    const blocks = convertBlocks(doc.content ?? [], registry);
    return { type: "root", children: blocks };
}

function convertBlocks(
    nodes: ReadonlyArray<JSONContent>,
    registry: DirectiveRegistry,
): RootContent[] {
    const out: RootContent[] = [];
    for (const node of nodes) {
        const converted = convertBlock(node, registry);
        if (Array.isArray(converted)) out.push(...converted);
        else if (converted) out.push(converted);
    }
    return out;
}

function convertBlock(
    node: JSONContent,
    registry: DirectiveRegistry,
): RootContent | RootContent[] | null {
    const type = node.type ?? "";
    switch (type) {
        case "paragraph":
            return convertParagraph(node);
        case "heading":
            return convertHeading(node);
        case "blockquote":
            return {
                type: "blockquote",
                children: convertBlocks(
                    node.content ?? [],
                    registry,
                ) as BlockContent[],
            };
        case "bulletList":
            return convertList(node, false, registry);
        case "orderedList":
            return convertList(node, true, registry);
        case "codeBlock":
            return convertCodeBlock(node);
        case "table":
            return convertTable(node);
        case "horizontalRule":
            return { type: "thematicBreak" };
        default:
            if (type.startsWith(DIRECTIVE_NODE_PREFIX)) {
                return convertDirective(node, registry, "block");
            }
            return null;
    }
}

function convertParagraph(node: JSONContent): Paragraph {
    return {
        type: "paragraph",
        children: convertInlineRun(node.content ?? []),
    };
}

function convertHeading(node: JSONContent): Heading {
    const level = clampHeadingLevel(
        (node.attrs?.["level"] as number | undefined) ?? 1,
    );
    return {
        type: "heading",
        depth: level,
        children: convertInlineRun(node.content ?? []),
    };
}

function clampHeadingLevel(level: number): 1 | 2 | 3 | 4 | 5 | 6 {
    if (level < 1) return 1;
    if (level > 6) return 6;
    return level as 1 | 2 | 3 | 4 | 5 | 6;
}

function convertList(
    node: JSONContent,
    ordered: boolean,
    registry: DirectiveRegistry,
): List {
    const start = ordered
        ? ((node.attrs?.["start"] as number | undefined) ?? 1)
        : null;
    const items = (node.content ?? [])
        .filter((c) => c.type === "listItem")
        .map((c) => convertListItem(c, registry));
    return {
        type: "list",
        ordered,
        spread: false,
        ...(ordered ? { start: start as number } : {}),
        children: items,
    } as List;
}

function convertListItem(
    node: JSONContent,
    registry: DirectiveRegistry,
): ListItem {
    return {
        type: "listItem",
        spread: false,
        children: convertBlocks(node.content ?? [], registry) as BlockContent[],
    };
}

function convertTable(node: JSONContent): Table {
    const rows = (node.content ?? []).filter((c) => c.type === "tableRow");
    const align = computeTableAlign(rows);
    const children = rows.map((row) => convertTableRow(row));
    return { type: "table", align, children };
}

function computeTableAlign(
    rows: ReadonlyArray<JSONContent>,
): Array<AlignType> {
    const widths = rows.map((row) => (row.content ?? []).length);
    const columnCount = widths.length > 0 ? Math.max(...widths) : 0;
    const align: Array<AlignType> = [];
    for (let column = 0; column < columnCount; column += 1) {
        let columnAlign: AlignType = null;
        for (const row of rows) {
            const cell = (row.content ?? [])[column];
            const value = cell?.attrs?.["textAlign"];
            if (
                value === "left" ||
                value === "center" ||
                value === "right"
            ) {
                columnAlign = value;
                break;
            }
        }
        align.push(columnAlign);
    }
    return align;
}

function convertTableRow(node: JSONContent): TableRow {
    const cells = (node.content ?? [])
        .filter((c) => c.type === "tableCell" || c.type === "tableHeader")
        .map((c) => convertTableCell(c));
    return { type: "tableRow", children: cells };
}

function convertTableCell(node: JSONContent): TableCell {
    const blocks = node.content ?? [];
    const inline: PhrasingContent[] = [];
    for (const block of blocks) {
        if (block.type !== "paragraph") continue;
        const run = convertInlineRun(block.content ?? []);
        if (inline.length > 0 && run.length > 0) {
            inline.push({ type: "break" });
        }
        inline.push(...run);
    }
    return { type: "tableCell", children: inline };
}

function convertCodeBlock(node: JSONContent): Code {
    const lang = (node.attrs?.["language"] as string | undefined) ?? null;
    const text = (node.content ?? [])
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("");
    return { type: "code", lang, meta: null, value: text };
}

function convertDirective(
    node: JSONContent,
    registry: DirectiveRegistry,
    contextKind: "block" | "inline",
): RootContent | null {
    const type = node.type ?? "";
    const directiveName = type.slice(DIRECTIVE_NODE_PREFIX.length);
    const def = registry.get(directiveName);
    if (!def) return null;
    const attributes = sanitizeAttrs(node.attrs);
    if (def.kind === "container") {
        const directive: ContainerDirective = {
            type: "containerDirective",
            name: directiveName,
            attributes,
            children: convertBlocks(
                node.content ?? [],
                registry,
            ) as ContainerDirective["children"],
        };
        return directive;
    }
    if (def.kind === "leaf") {
        const directive: LeafDirective = {
            type: "leafDirective",
            name: directiveName,
            attributes,
            children: [],
        };
        return directive;
    }
    // text directive — only legal inline; if found at block level, wrap in paragraph
    const directive: TextDirective = {
        type: "textDirective",
        name: directiveName,
        attributes,
        children: convertInlineRun(node.content ?? []) as PhrasingContent[],
    };
    if (contextKind === "inline") return directive as unknown as RootContent;
    return { type: "paragraph", children: [directive] };
}

function sanitizeAttrs(
    attrs: Record<string, unknown> | undefined,
): Record<string, string> {
    if (!attrs) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null) continue;
        out[key] = String(value);
    }
    return out;
}

function convertInlineRun(
    nodes: ReadonlyArray<JSONContent>,
): PhrasingContent[] {
    const out: PhrasingContent[] = [];
    for (const node of nodes) {
        const converted = convertInlineNode(node);
        if (Array.isArray(converted)) out.push(...converted);
        else if (converted) out.push(converted);
    }
    return out;
}

function convertInlineNode(
    node: JSONContent,
): PhrasingContent | PhrasingContent[] | null {
    const type = node.type ?? "";
    if (type === "text") {
        const text = node.text ?? "";
        if (text.length === 0) return null;
        const marks = (node.marks ?? []) as Mark[];
        return wrapWithMarks(text, marks);
    }
    if (type === "hardBreak") return { type: "break" };
    if (type === "image") return convertImage(node);
    if (type.startsWith(DIRECTIVE_NODE_PREFIX)) {
        // A directive used inline. Need a registry to resolve, but we don't
        // have it here; fall back to returning the node's text content.
        const text = (node.content ?? [])
            .map((c) => c.text)
            .filter((t): t is string => typeof t === "string")
            .join("");
        return text.length > 0 ? { type: "text", value: text } : null;
    }
    return null;
}

function convertImage(node: JSONContent): Image {
    return {
        type: "image",
        url: (node.attrs?.["src"] as string | undefined) ?? "",
        alt: (node.attrs?.["alt"] as string | undefined) ?? null,
        title: (node.attrs?.["title"] as string | undefined) ?? null,
    };
}

function wrapWithMarks(text: string, marks: Mark[]): PhrasingContent {
    const sorted = [...marks].sort(
        (a, b) => (MARK_PRIORITY[a.type] ?? 99) - (MARK_PRIORITY[b.type] ?? 99),
    );
    let inner: PhrasingContent = { type: "text", value: text };
    for (const mark of sorted) {
        inner = applyMark(inner, mark);
    }
    return inner;
}

function applyMark(node: PhrasingContent, mark: Mark): PhrasingContent {
    switch (mark.type) {
        case "bold":
            return { type: "strong", children: [node] };
        case "italic":
            return { type: "emphasis", children: [node] };
        case "strike":
            return { type: "delete", children: [node] };
        case "code":
            // inlineCode replaces — must come from text only
            if (node.type === "text") {
                return { type: "inlineCode", value: node.value };
            }
            return node;
        case "link": {
            const link: Link = {
                type: "link",
                url: (mark.attrs?.["href"] as string | undefined) ?? "",
                title:
                    (mark.attrs?.["title"] as string | null | undefined) ??
                    null,
                children: [node],
            };
            return link;
        }
        default:
            return node;
    }
}
