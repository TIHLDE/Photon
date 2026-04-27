import type { JSONContent } from "@tiptap/core";
import type {
    AlignType,
    Blockquote,
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
    Text,
} from "mdast";
import type { Directives } from "mdast-util-directive";

import type { DirectiveRegistry } from "../directive";

type Mark = { type: string; attrs?: Record<string, unknown> };

/**
 * Convert an mdast tree (parsed via remark with gfm + directive) to a TipTap
 * JSON document. Standard mdast nodes have a fixed mapping; directive nodes
 * present in the registry become `directive-${name}` nodes whose attributes
 * are the raw string-valued attributes from mdast.
 *
 * Directives not present in the registry degrade to a paragraph containing
 * a placeholder so content is preserved (and round-tripping is best-effort).
 */
export function mdastToTiptap(
    tree: Root,
    registry: DirectiveRegistry,
): JSONContent {
    return {
        type: "doc",
        content: convertBlocks(tree.children, registry),
    };
}

function convertBlocks(
    nodes: ReadonlyArray<RootContent>,
    registry: DirectiveRegistry,
): JSONContent[] {
    const out: JSONContent[] = [];
    for (const node of nodes) {
        const converted = convertBlock(node, registry);
        if (Array.isArray(converted)) {
            out.push(...converted);
        } else if (converted) {
            out.push(converted);
        }
    }
    return out;
}

function convertBlock(
    node: RootContent,
    registry: DirectiveRegistry,
): JSONContent | JSONContent[] | null {
    switch (node.type) {
        case "paragraph":
            return convertParagraph(node);
        case "heading":
            return convertHeading(node);
        case "blockquote":
            return convertBlockquote(node, registry);
        case "list":
            return convertList(node, registry);
        case "code":
            return convertCodeBlock(node);
        case "table":
            return convertTable(node);
        case "thematicBreak":
            return { type: "horizontalRule" };
        case "html":
            return {
                type: "paragraph",
                content: [{ type: "text", text: node.value }],
            };
        case "containerDirective":
        case "leafDirective":
        case "textDirective":
            return convertDirective(node as Directives, registry, "block");
        default:
            return null;
    }
}

function convertParagraph(node: Paragraph): JSONContent {
    const content = convertInline(node.children, []);
    return content.length > 0
        ? { type: "paragraph", content }
        : { type: "paragraph" };
}

function convertHeading(node: Heading): JSONContent {
    return {
        type: "heading",
        attrs: { level: node.depth },
        content: convertInline(node.children, []),
    };
}

function convertBlockquote(
    node: Blockquote,
    registry: DirectiveRegistry,
): JSONContent {
    return {
        type: "blockquote",
        content: convertBlocks(node.children, registry),
    };
}

function convertList(node: List, registry: DirectiveRegistry): JSONContent {
    const items: JSONContent[] = node.children
        .filter((child): child is ListItem => child.type === "listItem")
        .map((child) => convertListItem(child, registry));
    if (node.ordered) {
        return {
            type: "orderedList",
            attrs: { start: node.start ?? 1 },
            content: items,
        };
    }
    return { type: "bulletList", content: items };
}

function convertListItem(
    node: ListItem,
    registry: DirectiveRegistry,
): JSONContent {
    const blocks = convertBlocks(node.children, registry);
    return {
        type: "listItem",
        content: blocks.length > 0 ? blocks : [{ type: "paragraph" }],
    };
}

function convertTable(node: Table): JSONContent {
    const align = node.align ?? [];
    const rows = node.children.map((row, index) =>
        convertTableRow(row, align, index === 0),
    );
    return { type: "table", content: rows };
}

function convertTableRow(
    row: TableRow,
    align: ReadonlyArray<AlignType | null | undefined>,
    isHeader: boolean,
): JSONContent {
    const cells = row.children.map((cell, columnIndex) =>
        convertTableCell(cell, align[columnIndex] ?? null, isHeader),
    );
    return { type: "tableRow", content: cells };
}

function convertTableCell(
    cell: TableCell,
    alignment: AlignType | null | undefined,
    isHeader: boolean,
): JSONContent {
    const inline = convertInline(cell.children, []);
    const paragraph: JSONContent =
        inline.length > 0
            ? { type: "paragraph", content: inline }
            : { type: "paragraph" };
    const attrs: Record<string, unknown> = {};
    if (alignment) attrs["textAlign"] = alignment;
    return {
        type: isHeader ? "tableHeader" : "tableCell",
        ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
        content: [paragraph],
    };
}

function convertCodeBlock(node: Code): JSONContent {
    const text = node.value;
    return {
        type: "codeBlock",
        attrs: node.lang ? { language: node.lang } : {},
        content: text.length > 0 ? [{ type: "text", text }] : [],
    };
}

function convertDirective(
    node: Directives,
    registry: DirectiveRegistry,
    contextKind: "block" | "inline",
): JSONContent | JSONContent[] | null {
    if (registry.has(node.name)) {
        const directiveType = `directive-${node.name}`;
        const attrs = (node.attributes ?? {}) as Record<string, string>;
        if (node.type === "containerDirective") {
            return {
                type: directiveType,
                attrs,
                content: convertBlocks(
                    node.children as RootContent[],
                    registry,
                ),
            };
        }
        if (node.type === "leafDirective") {
            return { type: directiveType, attrs };
        }
        // textDirective is inline
        const inline = convertInline(node.children as PhrasingContent[], []);
        return contextKind === "inline"
            ? { type: directiveType, attrs, content: inline }
            : {
                  type: "paragraph",
                  content: [{ type: directiveType, attrs, content: inline }],
              };
    }
    // Unknown directive — preserve label/text content as a fallback.
    const fallbackText = `:${node.name}`;
    if (contextKind === "inline") {
        return { type: "text", text: fallbackText };
    }
    return {
        type: "paragraph",
        content: [{ type: "text", text: fallbackText }],
    };
}

function convertInline(
    nodes: ReadonlyArray<PhrasingContent>,
    marks: Mark[],
): JSONContent[] {
    const out: JSONContent[] = [];
    for (const node of nodes) {
        const converted = convertInlineNode(node, marks);
        if (Array.isArray(converted)) out.push(...converted);
        else if (converted) out.push(converted);
    }
    return out;
}

function convertInlineNode(
    node: PhrasingContent,
    marks: Mark[],
): JSONContent | JSONContent[] | null {
    switch (node.type) {
        case "text":
            return convertText(node, marks);
        case "emphasis":
            return convertInline(node.children, [...marks, { type: "italic" }]);
        case "strong":
            return convertInline(node.children, [...marks, { type: "bold" }]);
        case "delete":
            return convertInline(node.children, [...marks, { type: "strike" }]);
        case "inlineCode":
            return makeText(node.value, [...marks, { type: "code" }]);
        case "link":
            return convertLink(node, marks);
        case "break":
            return { type: "hardBreak" };
        case "image":
            return convertImage(node);
        case "textDirective":
            return null; // handled by block path; inline directives go through convertDirective
        default:
            return null;
    }
}

function convertText(node: Text, marks: Mark[]): JSONContent | null {
    return makeText(node.value, marks);
}

function makeText(value: string, marks: Mark[]): JSONContent | null {
    if (value.length === 0) return null;
    const text: JSONContent = { type: "text", text: value };
    if (marks.length > 0) text.marks = marks;
    return text;
}

function convertLink(node: Link, marks: Mark[]): JSONContent[] {
    const linkMark: Mark = {
        type: "link",
        attrs: {
            href: node.url,
            title: node.title ?? null,
        },
    };
    return convertInline(node.children, [...marks, linkMark]);
}

function convertImage(node: Image): JSONContent {
    return {
        type: "image",
        attrs: {
            src: node.url,
            alt: node.alt ?? "",
            title: node.title ?? null,
        },
    };
}
