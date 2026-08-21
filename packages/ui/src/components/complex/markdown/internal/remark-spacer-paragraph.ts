import type { Nodes, Paragraph, Parents, Root, RootContent } from "mdast";

// Et tomt avsnitt er forfatterens måte å be om litt ekstra luft på: enten to
// enter i editoren, eller — i innhold importert fra Lepton — et avsnitt med
// kun et non-breaking space. Rendret som et vanlig avsnitt blir det et hull på
// rundt 50 piksler, som er mye mer luft enn noen ba om. Vi gjør dem om til et
// tomt avsnitt merket `data-spacer`, som `<MarkdownContent>` gir en fast, liten
// høyde. Avsnitt helt i starten eller slutten av et element er bare polstring,
// og kastes.

/** Mellomrom, nbsp, zero-width space og BOM — alt som er usynlig. */
const BLANK = /^[\s ​﻿]*$/;

function hasChildren(node: Nodes): node is Parents {
    return Array.isArray((node as Parents).children);
}

function isBlankParagraph(node: RootContent): boolean {
    if (node.type !== "paragraph") return false;
    return node.children.every(
        (child) =>
            child.type === "break" ||
            (child.type === "text" && BLANK.test(child.value)),
    );
}

function toSpacer(node: Paragraph): Paragraph {
    return {
        ...node,
        children: [],
        data: { ...node.data, hProperties: { "data-spacer": "" } },
    };
}

function convertBlankParagraphs(node: Nodes): void {
    if (!hasChildren(node)) return;
    const children = node.children as RootContent[];
    const last = children.length - 1;
    node.children = children
        .map((child, index) => {
            if (!isBlankParagraph(child)) return child;
            // Polstring i kantene bærer ingen mening.
            if (index === 0 || index === last) return null;
            // En overskrift har allerede sin egen avstand ned til teksten.
            // Den blanke linja der er en vane fra editorer som ikke ga noen.
            if (children[index - 1]?.type === "heading") return null;
            return toSpacer(child as Paragraph);
        })
        .filter((child) => child !== null) as Parents["children"];
    for (const child of node.children) convertBlankParagraphs(child);
}

/**
 * Remark-plugin som gjør avsnitt uten synlig innhold om til et lite
 * mellomrom, uansett hvor dypt de ligger (rot, sitatblokk, listepunkt,
 * direktiv).
 */
export function remarkSpacerParagraphs() {
    return (tree: Root) => {
        convertBlankParagraphs(tree);
    };
}
