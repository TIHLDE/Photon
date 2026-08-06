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
                // Markdown kan inneholde innhold som er bredere enn skjermen
                // (tabeller, kodeblokker, lange URL-er). Det skal skrolle i sin
                // egen boks — ellers presser det hele sida ut på mobil.
                "break-words [&_pre]:overflow-x-auto [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto",
                "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-32",
                "[&_.ProseMirror>:first-child]:mt-0 [&_.ProseMirror>:last-child]:mb-0",
                // Skrivefeil fra den norske stavekontrollen. Samme rød
                // bølgestrek som nettleseren selv bruker, så den er kjent
                // igjen med en gang.
                "[&_.spelling-error]:[text-decoration:underline_wavy_var(--color-destructive)] [&_.spelling-error]:[text-underline-offset:0.2em] [&_.spelling-error]:[text-decoration-skip-ink:none]",
                className,
            )}
            {...rest}
        >
            {children}
        </div>
    );
}
