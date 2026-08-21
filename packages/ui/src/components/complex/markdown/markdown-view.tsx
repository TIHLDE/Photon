import { useMemo } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";

import type { DirectiveRegistry } from "./directive";
import { buildComponentsMap } from "./internal/components-map";
import { remarkCollapseBlankParagraphs } from "./internal/remark-collapse-blank";
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
                buildRemarkDirectivePlugin(registry),
                // Gammelt Lepton-innhold har avsnitt med kun nbsp. De ser ut
                // som store hull, så de fjernes her og i editorens parser.
                remarkCollapseBlankParagraphs,
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
