import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { loadSpeller, type Speller } from "./speller";

const spellcheckKey = new PluginKey<DecorationSet>("norsk-stavekontroll");

/**
 * Ord skilles på alt som ikke er bokstav, bindestrek eller apostrof, slik at
 * «e-post» og «TIHLDEs» holdes samlet. `\p{L}` fanger æ, ø og å.
 */
const WORD_PATTERN = /[\p{L}][\p{L}'’-]*/gu;

/** Ord med tall eller versaler i seg — koder, forkortelser, TIHLDE-slang. */
function shouldSkip(word: string): boolean {
    if (word.length < 3) return true;
    // ALLEVERSALER og CamelCase er som regel navn og forkortelser, ikke feil.
    if (word === word.toUpperCase()) return true;
    return false;
}

function buildDecorations(doc: ProseMirrorNode, speller: Speller) {
    const decorations: Decoration[] = [];

    doc.descendants((node, position) => {
        if (!node.isText || !node.text) return;

        for (const match of node.text.matchAll(WORD_PATTERN)) {
            const word = match[0];
            if (match.index === undefined || shouldSkip(word)) continue;
            if (!speller.isMisspelled(word)) continue;

            const from = position + match.index;
            decorations.push(
                Decoration.inline(from, from + word.length, {
                    class: "spelling-error",
                }),
            );
        }
    });

    return DecorationSet.create(doc, decorations);
}

/**
 * Marker skrivefeil med rød bølgestrek, på samme måte som nettleseren ville
 * gjort om brukeren hadde norsk ordbok installert.
 *
 * Ordboka lastes i bakgrunnen. Fram til den er klar — og hvis den aldri blir
 * det — ligger dekorasjonene tomme, og nettleserens egen stavekontroll står
 * for det den måtte klare.
 */
export const NorwegianSpellcheck = Extension.create({
    name: "norwegianSpellcheck",

    addProseMirrorPlugins() {
        let speller: Speller | null = null;

        return [
            new Plugin<DecorationSet>({
                key: spellcheckKey,

                view(editorView) {
                    let cancelled = false;

                    void loadSpeller().then((loaded) => {
                        if (cancelled || !loaded) return;
                        speller = loaded;
                        // Ordboka kom etter at teksten ble lagt inn, så
                        // gjennomgangen må trigges på nytt.
                        editorView.dispatch(
                            editorView.state.tr.setMeta(spellcheckKey, true),
                        );
                    });

                    return {
                        destroy() {
                            cancelled = true;
                        },
                    };
                },

                state: {
                    init(_, state: EditorState) {
                        return speller
                            ? buildDecorations(state.doc, speller)
                            : DecorationSet.empty;
                    },
                    apply(
                        transaction: Transaction,
                        current: DecorationSet,
                    ): DecorationSet {
                        if (!speller) return DecorationSet.empty;

                        // Uendret tekst: flytt eksisterende markeringer i takt
                        // med endringen i stedet for å gå gjennom alt på nytt.
                        if (
                            !transaction.docChanged &&
                            !transaction.getMeta(spellcheckKey)
                        ) {
                            return current.map(
                                transaction.mapping,
                                transaction.doc,
                            );
                        }

                        return buildDecorations(transaction.doc, speller);
                    },
                },

                props: {
                    decorations(state) {
                        return spellcheckKey.getState(state);
                    },
                },
            }),
        ];
    },
});
