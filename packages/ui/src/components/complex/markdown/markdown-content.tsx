import type { ComponentProps, ReactNode } from "react";

import { cn } from "#/lib/utils";

export type MarkdownContentProps = ComponentProps<"div"> & {
    children?: ReactNode;
};

/**
 * Typography wrapper used by both `<MarkdownView>` and `<RichEditor>` so that
 * authored content and rendered content look identical. Owns the typography
 * decisions (currently @tailwindcss/typography's `prose`) so kvark's CLAUDE.md
 * "layout-only" rule is preserved on the consumer side.
 *
 * Includes a ProseMirror-aware reset for the first/last child margin so
 * editor content sits flush against the editor's padding the same way the
 * renderer's first paragraph does.
 */
export function MarkdownContent({
    className,
    children,
    ...rest
}: MarkdownContentProps) {
    return (
        <div
            data-slot="markdown-content"
            className={cn(
                "prose prose-sm max-w-none",
                "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-32",
                "[&_.ProseMirror>:first-child]:mt-0 [&_.ProseMirror>:last-child]:mb-0",
                className,
            )}
            {...rest}
        >
            {children}
        </div>
    );
}
