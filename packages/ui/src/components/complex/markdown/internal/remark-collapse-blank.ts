import type { Nodes, Parents, Root, RootContent } from "mdast";

// Innhold importert fra Lepton ble skrevet i en gammel rik-tekst-editor som
// la igjen avsnitt bestående av kun et non-breaking space der forfatteren
// bare ville ha litt luft. De rendres som helt vanlige avsnitt, med linje-
// høyde og marg over og under, så teksten får hull på rundt 50 piksler oppå
// den vanlige avstanden mellom to avsnitt. Vi kaster dem i stedet, slik at
// et avsnittsskift ser ut som et avsnittsskift.

/** Mellomrom, nbsp, zero-width space og BOM — alt som er usynlig. */
const BLANK = /^[\s ​﻿]*$/;

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

function stripBlankParagraphs(node: Nodes): void {
    if (!hasChildren(node)) return;
    node.children = node.children.filter(
        (child) => !isBlankParagraph(child),
    ) as Parents["children"];
    for (const child of node.children) stripBlankParagraphs(child);
}

/**
 * Remark-plugin som fjerner avsnitt uten synlig innhold, uansett hvor dypt de
 * ligger (rot, sitatblokk, listepunkt, direktiv).
 */
export function remarkCollapseBlankParagraphs() {
    return (tree: Root) => {
        stripBlankParagraphs(tree);
    };
}
