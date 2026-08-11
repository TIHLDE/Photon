import { Autocomplete as AutocompletePrimitive } from "@base-ui/react";

import {
    ComboboxCollection,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "#/components/ui/combobox";

/**
 * Tekstfelt med forslagsliste, der fritekst er et gyldig svar.
 *
 * Forskjellen fra `Combobox` er hvem som eier teksten. `Combobox` husker en
 * valgt verdi (`selectionMode: "single"`) og synkroniserer feltet mot den når
 * lista lukkes — står det ingen valgt verdi, blir feltet tømt. Det gjør den
 * ubrukelig for felt der brukeren kan skrive hva som helst: teksten forsvant
 * idet forslagslista forsvant.
 *
 * `Autocomplete` har ingen valgt verdi (`selectionMode: "none"`). Teksten er
 * verdien, den kommer inn som `value` og ut som `onValueChange`, og et klikk på
 * et forslag fyller feltet med forslagets etikett.
 *
 * Delene under lista er de samme komponentene som `Combobox` bruker — Base UI
 * eksporterer dem fra begge, så de er aliaser og ikke kopier, og utseendet
 * holdes ett sted.
 */
const Autocomplete = AutocompletePrimitive.Root;

const AutocompleteInput = ComboboxInput;
const AutocompleteContent = ComboboxContent;
const AutocompleteList = ComboboxList;
const AutocompleteItem = ComboboxItem;
const AutocompleteCollection = ComboboxCollection;
const AutocompleteEmpty = ComboboxEmpty;

export {
    Autocomplete,
    AutocompleteCollection,
    AutocompleteContent,
    AutocompleteEmpty,
    AutocompleteInput,
    AutocompleteItem,
    AutocompleteList,
};
