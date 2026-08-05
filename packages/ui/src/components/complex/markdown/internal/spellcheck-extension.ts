import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

import { loadSpeller, type Speller } from "./speller";

const spellcheckKey = new PluginKey<DecorationSet>("norsk-stavekontroll");

/**
 * Ord skilles på alt som ikke er bokstav, bindestrek eller apostrof, slik at
 * «e-post» og «TIHLDEs» holdes samlet. `\p{L}` fanger æ, ø og å.
 */
const WORD_PATTERN = /[\p{L}][\p{L}'’-]*/gu;

/** Et ord i teksten som ordboka ikke kjenner igjen. */
export type Misspelling = {
    word: string;
    /** Posisjonen ordet starter og slutter på i dokumentet. */
    from: number;
    to: number;
};

/** Skrivefeilen brukeren klikket på, klar til å vises i en boble. */
export type SpellcheckSelection = Misspelling & {
    /** Ordboka sine forslag, tom når den ikke har noen. */
    suggestions: string[];
    /** Hvor ordet står på skjermen, i koordinater fra `getBoundingClientRect`. */
    rect: { top: number; bottom: number; left: number; right: number };
};

export type SpellcheckOptions = {
    /**
     * Kalles når brukeren klikker på et ord med rød strek, og med `null` når
     * klikket havnet et sted uten skrivefeil. Uten denne markeres feilene bare.
     */
    onSelect?: (selection: SpellcheckSelection | null) => void;
};

/** Ord med tall eller versaler i seg — koder, forkortelser, TIHLDE-slang. */
function shouldSkip(word: string): boolean {
    if (word.length < 3) return true;
    // ALLEVERSALER og CamelCase er som regel navn og forkortelser, ikke feil.
    if (word === word.toUpperCase()) return true;
    return false;
}

/** Gå gjennom hver skrivefeil i dokumentet én gang. */
function forEachMisspelling(
    doc: ProseMirrorNode,
    speller: Speller,
    visit: (misspelling: Misspelling) => void,
) {
    doc.descendants((node, position) => {
        if (!node.isText || !node.text) return;

        for (const match of node.text.matchAll(WORD_PATTERN)) {
            const word = match[0];
            if (match.index === undefined || shouldSkip(word)) continue;
            if (!speller.isMisspelled(word)) continue;

            const from = position + match.index;
            visit({ word, from, to: from + word.length });
        }
    });
}

function buildDecorations(doc: ProseMirrorNode, speller: Speller) {
    const decorations: Decoration[] = [];

    forEachMisspelling(doc, speller, ({ word, from, to }) => {
        decorations.push(
            Decoration.inline(from, to, {
                class: "spelling-error",
                // Hjelper også de som bare holder musa over ordet, og de som
                // ikke ser forskjell på en rød og en svart bølgestrek.
                title: `«${word}» står ikke i ordboka. Klikk for forslag.`,
            }),
        );
    });

    return DecorationSet.create(doc, decorations);
}

/** Skrivefeilen som dekker posisjonen, om det er noen der. */
function misspellingAt(
    doc: ProseMirrorNode,
    speller: Speller,
    position: number,
): Misspelling | null {
    let found: Misspelling | null = null;
    forEachMisspelling(doc, speller, (misspelling) => {
        if (found) return;
        if (position >= misspelling.from && position <= misspelling.to) {
            found = misspelling;
        }
    });
    return found;
}

/** Legg til forslag og skjermplassering, slik boblen trenger det. */
function describe(
    view: EditorView,
    speller: Speller,
    misspelling: Misspelling,
): SpellcheckSelection {
    const start = view.coordsAtPos(misspelling.from);
    const end = view.coordsAtPos(misspelling.to);

    return {
        ...misspelling,
        suggestions: speller.suggest(misspelling.word),
        rect: {
            top: Math.min(start.top, end.top),
            bottom: Math.max(start.bottom, end.bottom),
            left: Math.min(start.left, end.left),
            right: Math.max(start.right, end.right),
        },
    };
}

/**
 * Marker skrivefeil med rød bølgestrek, på samme måte som nettleseren ville
 * gjort om brukeren hadde norsk ordbok installert, og si fra når noen klikker
 * på en av dem så editoren kan vise forslag til retting.
 *
 * Ordboka lastes i bakgrunnen. Fram til den er klar — og hvis den aldri blir
 * det — ligger dekorasjonene tomme, og nettleserens egen stavekontroll står
 * for det den måtte klare.
 */
export const NorwegianSpellcheck = Extension.create<SpellcheckOptions>({
    name: "norwegianSpellcheck",

    addOptions() {
        return { onSelect: undefined };
    },

    addProseMirrorPlugins() {
        let speller: Speller | null = null;
        const options = this.options;

        /** Svarer true når klikket traff en skrivefeil. */
        function report(view: EditorView, position: number): boolean {
            const { onSelect } = options;
            if (!onSelect) return false;

            const misspelling = speller
                ? misspellingAt(view.state.doc, speller, position)
                : null;

            if (!misspelling || !speller) {
                onSelect(null);
                return false;
            }

            onSelect(describe(view, speller, misspelling));
            return true;
        }

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

                    handleClick(view, position) {
                        report(view, position);
                        // Markøren skal fortsatt flytte seg dit man klikket.
                        return false;
                    },

                    handleDOMEvents: {
                        // Høyreklikk er der folk er vant til å lete etter
                        // stavekontrollens forslag. Nettlesermenyen får stå i
                        // fred når ordet ikke har en feil å rette.
                        contextmenu(view, event) {
                            const position = view.posAtCoords({
                                left: event.clientX,
                                top: event.clientY,
                            });
                            if (!position) return false;
                            if (!report(view, position.pos)) return false;
                            event.preventDefault();
                            return true;
                        },
                    },
                },
            }),
        ];
    },
});
