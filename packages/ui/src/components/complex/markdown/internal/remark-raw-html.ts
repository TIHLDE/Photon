import type { Image, Link, PhrasingContent, Root, RootContent } from "mdast";
import type { ContainerDirective } from "mdast-util-directive";
import type { Plugin } from "unified";
import { visit, SKIP } from "unist-util-visit";

import type { DirectiveRegistry } from "../directive";

// Innhold fra Lepton har rå HTML i seg: bildegallerier i `<div>`-er, `<br>`
// for linjeskift og `<iframe>` med PDF-er fra Google Drive. Ingenting av det
// blir rendret — react-markdown skriver det ut som synlig kildekode, og
// editoren viser det som tekst. Vi plukker ut det som faktisk er innhold og
// kaster resten. Vilkårlig HTML slipper aldri gjennom, så det er ingen vei
// inn for skript eller stiler.

/** Navnet på galleridirektivet, delt mellom parseren og registeret. */
export const GALLERY_DIRECTIVE = "gallery";

const TAG =
    /<(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'=<>`]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;

/** Innholdet i disse er kode eller stil, ikke tekst, og skal ikke vises. */
const SKJULT_INNHOLD = new Set(["script", "style", "template", "noscript"]);
const ATTR = /([^\s"'=<>`/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

const ENTITIES: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
};

function decodeEntities(value: string): string {
    return value.replace(
        /&(?:amp|lt|gt|quot|apos|nbsp|#39);/g,
        (match) => ENTITIES[match] ?? match,
    );
}

function attributesOf(raw: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const match of raw.matchAll(ATTR)) {
        const value = match[2] ?? match[3] ?? match[4] ?? "";
        attrs[match[1]!.toLowerCase()] = decodeEntities(value);
    }
    return attrs;
}

/** Bare http(s) og relative adresser. `javascript:` og resten kastes. */
function safeUrl(url: string | undefined): string | null {
    if (!url) return null;
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[./]/.test(trimmed)) return trimmed;
    return null;
}

/**
 * Gjør en bit rå HTML om til ekte markdown-noder. Tagger vi ikke kjenner blir
 * borte, men teksten mellom dem står igjen.
 */
function convertHtml(value: string): PhrasingContent[] {
    const out: PhrasingContent[] = [];
    let cursor = 0;

    let skjuler: string | null = null;

    const pushText = (text: string) => {
        if (skjuler) return;
        const decoded = decodeEntities(text);
        // Linjeskiftene mellom taggene i en `<div>` er formatering, ikke tekst.
        if (decoded.trim() === "") return;
        out.push({ type: "text", value: decoded });
    };

    for (const match of value.matchAll(TAG)) {
        pushText(value.slice(cursor, match.index));
        cursor = match.index + match[0].length;
        const lukkes = match[1] === "/";
        const name = match[2]!.toLowerCase();
        const attrs = attributesOf(match[3] ?? "");
        if (skjuler) {
            if (lukkes && name === skjuler) skjuler = null;
            continue;
        }
        if (SKJULT_INNHOLD.has(name)) {
            if (!lukkes) skjuler = name;
            continue;
        }
        if (name === "br") {
            out.push({ type: "break" });
            continue;
        }
        if (name === "img") {
            const url = safeUrl(attrs["src"]);
            if (!url) continue;
            const image: Image = {
                type: "image",
                url,
                alt: attrs["alt"] ?? null,
                title: null,
            };
            out.push(image);
            continue;
        }
        if (name === "iframe") {
            // Et innbygd dokument kan vi ikke vise trygt, men adressen er
            // innhold. Den blir en lenke, så den er fortsatt til å åpne.
            const url = safeUrl(attrs["src"]);
            if (!url) continue;
            const link: Link = {
                type: "link",
                url,
                title: null,
                children: [{ type: "text", value: url }],
            };
            out.push(link);
            continue;
        }
        // `<div>`, `<u>`, `</del>` og alt annet: taggen forsvinner.
    }
    pushText(value.slice(cursor));
    return out;
}

const PHRASING_PARENTS = new Set([
    "paragraph",
    "heading",
    "tableCell",
    "emphasis",
    "strong",
    "delete",
    "link",
    "linkReference",
]);

/**
 * Flere bilder i samme HTML-blokk var et galleri hos forfatteren — bildene
 * lå side om side i en `<div>` med flex. Kan registeret vise et galleri, blir
 * det et galleri; ellers blir bildene liggende under hverandre i et avsnitt.
 */
function toBlock(
    converted: PhrasingContent[],
    registry: DirectiveRegistry,
): RootContent[] {
    if (converted.length === 0) return [];
    const images = converted.filter((node) => node.type === "image");
    if (images.length > 1 && registry.has(GALLERY_DIRECTIVE)) {
        const gallery: ContainerDirective = {
            type: "containerDirective",
            name: GALLERY_DIRECTIVE,
            attributes: {},
            children: images.map((image) => ({
                type: "paragraph",
                children: [image],
            })),
        };
        const resten = converted.filter((node) => node.type !== "image");
        return resten.length > 0
            ? [gallery, { type: "paragraph", children: resten }]
            : [gallery];
    }
    return [{ type: "paragraph", children: converted }];
}

/**
 * Remark-plugin som bytter ut rå HTML med de nodene innholdet faktisk er:
 * bilder, linjeskift og lenker. Resten kastes, så ingen ser kildekode.
 */
export function buildRemarkRawHtmlPlugin(
    registry: DirectiveRegistry,
): Plugin<[], Root> {
    return () => (tree: Root) => {
        visit(tree, "html", (node, index, parent) => {
            if (!parent || index === undefined) return;
            const converted = convertHtml(node.value);
            let lagtInn = converted.length;
            if (PHRASING_PARENTS.has(parent.type)) {
                (parent.children as PhrasingContent[]).splice(
                    index,
                    1,
                    ...converted,
                );
            } else {
                const replacement = toBlock(converted, registry);
                lagtInn = replacement.length;
                (parent.children as RootContent[]).splice(
                    index,
                    1,
                    ...replacement,
                );
            }
            return [SKIP, index + lagtInn];
        });
    };
}
