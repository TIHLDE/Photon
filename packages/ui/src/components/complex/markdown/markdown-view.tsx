import { useMemo } from "react";
import Markdown from "react-markdown";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";

import type { DirectiveRegistry } from "./directive";
import { buildComponentsMap } from "./internal/components-map";
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
                remarkDirective,
                buildRemarkDirectivePlugin(registry),
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
