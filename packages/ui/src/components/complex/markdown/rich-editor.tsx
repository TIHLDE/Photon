import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DirectiveRegistry } from "./directive";
import { EditorToolbar } from "./editor-toolbar";
import { MarkdownContent } from "./markdown-content";
import { mdastToTiptap } from "./internal/mdast-to-pm";
import { parseMarkdown, stringifyMdast } from "./internal/pipeline";
import { tiptapToMdast } from "./internal/pm-to-mdast";
import { SpellSuggestions } from "./internal/spell-suggestions";
import type { SpellcheckSelection } from "./internal/spellcheck-extension";
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
    const containerRef = useRef<HTMLDivElement>(null);
    const [misspelling, setMisspelling] = useState<SpellcheckSelection | null>(
        null,
    );

    // Stavekontrollen bygges én gang og kan ikke se React-state, så den melder
    // fra gjennom en ref som alltid peker på gjeldende setter.
    const selectRef = useRef(setMisspelling);
    selectRef.current = setMisspelling;
    const onSpellcheckSelect = useCallback(
        (selection: SpellcheckSelection | null) => selectRef.current(selection),
        [],
    );

    const extensions = useMemo(
        () =>
            buildTiptapExtensions(registry, {
                placeholder,
                spellcheck: spellCheck,
                onSpellcheckSelect,
            }),
        [registry, placeholder, spellCheck, onSpellcheckSelect],
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
            // Posisjonene i boblen gjelder teksten slik den var, så den lukkes
            // så snart noe skrives.
            setMisspelling(null);
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

    const applySuggestion = useCallback(
        (replacement: string) => {
            if (!editor || !misspelling) return;
            const { from, to } = misspelling;
            setMisspelling(null);
            editor
                .chain()
                .focus()
                .command(({ tr }) => {
                    // Ordet kan stå i en lenke eller i fet skrift, og de
                    // markene skal følge med over på rettelsen.
                    const marks = tr.doc.resolve(from + 1).marks();
                    tr.replaceWith(
                        from,
                        to,
                        editor.schema.text(replacement, marks),
                    );
                    return true;
                })
                .run();
        },
        [editor, misspelling],
    );

    const dismissSuggestions = useCallback(() => setMisspelling(null), []);

    return (
        <div className={className}>
            <div ref={containerRef} className="relative rounded border">
                <EditorToolbar editor={editor} registry={registry} />
                <MarkdownContent className="border-t px-3 py-2">
                    <EditorContent editor={editor} />
                </MarkdownContent>
                {misspelling && (
                    <SpellSuggestions
                        selection={misspelling}
                        container={containerRef.current}
                        onApply={applySuggestion}
                        onDismiss={dismissSuggestions}
                    />
                )}
            </div>
        </div>
    );
}
