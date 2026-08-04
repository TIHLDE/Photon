import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef } from "react";

import type { DirectiveRegistry } from "./directive";
import { EditorToolbar } from "./editor-toolbar";
import { MarkdownContent } from "./markdown-content";
import { mdastToTiptap } from "./internal/mdast-to-pm";
import { parseMarkdown, stringifyMdast } from "./internal/pipeline";
import { tiptapToMdast } from "./internal/pm-to-mdast";
import { buildTiptapExtensions } from "./internal/tiptap-extensions";

export type RichEditorProps = {
    registry: DirectiveRegistry;
    value: string;
    onChange: (markdown: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    className?: string;
    /** Ordboken nettleseren staveretter mot. Innholdet er norsk. */
    lang?: string;
    /** Rød strek under skrivefeil. På som standard. */
    spellCheck?: boolean;
};

export function RichEditor({
    registry,
    value,
    onChange,
    placeholder,
    autoFocus,
    className,
    lang = "nb",
    spellCheck = true,
}: RichEditorProps) {
    const lastEmitted = useRef(value);

    const extensions = useMemo(
        () =>
            buildTiptapExtensions(registry, {
                placeholder,
                spellcheck: spellCheck,
            }),
        [registry, placeholder, spellCheck],
    );

    const initialContent = useMemo(
        () => mdastToTiptap(parseMarkdown(value), registry),
        // Only on first mount — subsequent value changes are handled below.
        // oxlint-disable: react-hooks/exhaustive-deps
        [],
    );

    const editor = useEditor({
        extensions,
        content: initialContent,
        immediatelyRender: false,
        autofocus: autoFocus ? "end" : false,
        editorProps: {
            attributes: {
                // Innholdet skrives på norsk, og stavekontrollen slås på
                // eksplisitt: teksten her ender opp på arrangementer og
                // nyheter, der skrivefeil blir stående lenge.
                lang,
                spellcheck: String(spellCheck),
                // Be Grammarly holde seg unna. Utvidelsen overtar felt den
                // kobler seg på og slår av nettleserens egen stavekontroll,
                // men retter bare engelsk — resultatet på et norsk felt er
                // ingen rød strek i det hele tatt. Uten Grammarly installert
                // gjør attributtene ingenting.
                "data-gramm": "false",
                "data-gramm_editor": "false",
                "data-enable-grammarly": "false",
            },
        },
        onUpdate: ({ editor: instance }) => {
            const json = instance.getJSON();
            const mdast = tiptapToMdast(json, registry);
            const markdown = stringifyMdast(mdast);
            lastEmitted.current = markdown;
            onChange(markdown);
        },
    });

    useEffect(() => {
        if (!editor) return;
        if (value === lastEmitted.current) return;
        const json = mdastToTiptap(parseMarkdown(value), registry);
        editor.commands.setContent(json, { emitUpdate: false });
        lastEmitted.current = value;
    }, [editor, value, registry]);

    return (
        <div className={className}>
            <div className="rounded border">
                <EditorToolbar editor={editor} registry={registry} />
                <MarkdownContent className="border-t px-3 py-2">
                    <EditorContent editor={editor} />
                </MarkdownContent>
            </div>
        </div>
    );
}
