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
                "wrap-anywhere [&_pre]:overflow-x-auto [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto",
                "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-32",
                "[&_.ProseMirror>:first-child]:mt-0 [&_.ProseMirror>:last-child]:mb-0",
                // Et tomt avsnitt betyr «litt ekstra luft her». Et helt avsnitt
                // er for mye, så det får en fast, liten høyde uten marger.
                "[&_p[data-spacer]]:my-0 [&_p[data-spacer]]:h-2",
                // En overskrift hører til teksten under seg, ikke til
                // avsnittet over. Elementet rett etter mister toppmarga si, så
                // det er overskrifta som bestemmer avstanden — og den blir
                // gradvis mindre jo lavere nivået er.
                "[&_h1]:mb-3.5 [&_h2]:mb-3 [&_h3]:mb-2.5 [&_h4]:mb-2 [&_h5]:mb-1.5 [&_h6]:mb-1",
                "[&_h1+*]:mt-0 [&_h2+*]:mt-0 [&_h3+*]:mt-0 [&_h4+*]:mt-0 [&_h5+*]:mt-0 [&_h6+*]:mt-0",
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
