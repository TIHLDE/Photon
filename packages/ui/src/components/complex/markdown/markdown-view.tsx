import { useMemo } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";

import type { DirectiveRegistry } from "./directive";
import { buildComponentsMap } from "./internal/components-map";
import { buildRemarkRawHtmlPlugin } from "./internal/remark-raw-html";
import { remarkSpacerParagraphs } from "./internal/remark-spacer-paragraph";
import { buildRemarkDirectivePlugin } from "./internal/remark-directive-hast";
import { MarkdownContent } from "./markdown-content";

export type MarkdownViewProps = {
    registry: DirectiveRegistry;
    source: string;
    className?: string;
};

export function MarkdownView({
    registry,
    source,
    className,
}: MarkdownViewProps) {
    const { remarkPlugins, components } = useMemo(
        () => ({
            remarkPlugins: [
                remarkGfm,
                // Samme regel som i editoren: ett linjeskift vises som ett
                // linjeskift, slik forfatteren skrev det.
                remarkBreaks,
                remarkDirective,
                // Rå HTML blir til bilder, linjeskift og lenker — aldri
                // synlig kildekode. Samme regel som i editorens parser. Må
                // kjøre før direktiv-plugin-et under, for flere bilder i
                // samme HTML-blokk blir et galleridirektiv.
                buildRemarkRawHtmlPlugin(registry),
                buildRemarkDirectivePlugin(registry),
                // Tomme avsnitt blir et lite mellomrom i stedet for et
                // helt avsnitt. Samme regel som i editorens parser.
                remarkSpacerParagraphs,
            ],
            components: buildComponentsMap(registry),
        }),
        [registry],
    );

    return (
        <MarkdownContent className={className}>
            <Markdown remarkPlugins={remarkPlugins} components={components}>
                {source}
            </Markdown>
        </MarkdownContent>
    );
}
