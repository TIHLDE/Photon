import type {
    Image,
    Link,
    Paragraph,
    PhrasingContent,
    Root,
    RootContent,
} from "mdast";
import { visit, SKIP } from "unist-util-visit";

// Innhold fra Lepton har rå HTML i seg: bildegallerier i `<div>`-er, `<br>`
// for linjeskift og `<iframe>` med PDF-er fra Google Drive. Ingenting av det
// blir rendret — react-markdown skriver det ut som synlig kildekode, og
// editoren viser det som tekst. Vi plukker ut det som faktisk er innhold og
// kaster resten. Vilkårlig HTML slipper aldri gjennom, så det er ingen vei
// inn for skript eller stiler.

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
 * Remark-plugin som bytter ut rå HTML med de nodene innholdet faktisk er:
 * bilder, linjeskift og lenker. Resten kastes, så ingen ser kildekode.
 */
export function remarkRawHtml() {
    return (tree: Root) => {
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
                // I en blokk må innholdet ligge i et avsnitt, så uansett hvor
                // mange bilder som kom ut blir det én ny node — eller ingen.
                const replacement: Paragraph[] =
                    converted.length > 0
                        ? [{ type: "paragraph", children: converted }]
                        : [];
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
