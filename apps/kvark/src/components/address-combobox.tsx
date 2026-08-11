import {
    Autocomplete,
    AutocompleteCollection,
    AutocompleteContent,
    AutocompleteEmpty,
    AutocompleteInput,
    AutocompleteItem,
    AutocompleteList,
} from "@tihlde/ui/ui/autocomplete";

import type { AddressSuggestion } from "#/api/queries/address";

type AddressComboboxProps = {
    id?: string;
    /**
     * Teksten i feltet — også det som lagres som sted. Fritekst er lov, så
     * "Digitalt" eller "R1" fungerer like godt som en ekte adresse.
     */
    value: string;
    onValueChange: (next: string) => void;
    suggestions: AddressSuggestion[];
    isSearching?: boolean;
    /** Kalles når brukeren velger en adresse fra søket (gir koordinater). */
    onSelectSuggestion: (suggestion: AddressSuggestion) => void;
    placeholder?: string;
    required?: boolean;
};

/**
 * Stedsfelt med adressesøk. Dum komponent: forelderen eier både teksten og
 * henting av forslag.
 *
 * Bygget på `Autocomplete` og ikke `Combobox`, fordi feltet ikke har noen valgt
 * verdi — teksten *er* verdien. En `Combobox` uten valgt verdi tømmer feltet
 * når forslagslista lukkes, som gjorde det umulig å skrive inn et sted.
 */
export function AddressCombobox({
    id,
    value,
    onValueChange,
    suggestions,
    isSearching = false,
    onSelectSuggestion,
    placeholder = "Søk etter adresse, eller skriv fritt",
    required = false,
}: AddressComboboxProps) {
    return (
        <Autocomplete<AddressSuggestion>
            items={suggestions}
            // Treffene er allerede filtrert av Kartverket-søket.
            filter={null}
            value={value}
            onValueChange={onValueChange}
            itemToStringValue={(item) => item.label}
        >
            <AutocompleteInput
                id={id}
                required={required}
                placeholder={placeholder}
                showTrigger={false}
                autoComplete="off"
            />
            <AutocompleteContent>
                <AutocompleteList>
                    <AutocompleteEmpty>
                        {isSearching ? "Søker…" : "Ingen adresser matcher"}
                    </AutocompleteEmpty>
                    <AutocompleteCollection>
                        {(item: AddressSuggestion) => (
                            <AutocompleteItem
                                key={item.id}
                                value={item}
                                // Teksten fylles inn av Autocomplete selv;
                                // dette er kun for å gi forelderen
                                // koordinatene som hører til adressen.
                                onClick={() => onSelectSuggestion(item)}
                            >
                                <span className="flex min-w-0 flex-col">
                                    <span className="truncate">
                                        {item.street}
                                    </span>
                                    {item.postal ? (
                                        <span className="truncate text-xs text-muted-foreground">
                                            {item.postal}
                                        </span>
                                    ) : null}
                                </span>
                            </AutocompleteItem>
                        )}
                    </AutocompleteCollection>
                </AutocompleteList>
            </AutocompleteContent>
        </Autocomplete>
    );
}
