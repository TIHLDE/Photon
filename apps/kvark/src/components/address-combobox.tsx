import {
    Combobox,
    ComboboxCollection,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@tihlde/ui/ui/combobox";

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
        <Combobox<AddressSuggestion>
            items={suggestions}
            // Treffene er allerede filtrert av Kartverket-søket.
            filter={null}
            value={null}
            inputValue={value}
            onInputValueChange={onValueChange}
            onValueChange={(next) => {
                if (next) onSelectSuggestion(next);
            }}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.id}
        >
            <ComboboxInput
                id={id}
                required={required}
                placeholder={placeholder}
                showTrigger={false}
                autoComplete="off"
            />
            <ComboboxContent>
                <ComboboxList>
                    <ComboboxEmpty>
                        {isSearching ? "Søker…" : "Ingen adresser matcher"}
                    </ComboboxEmpty>
                    <ComboboxCollection>
                        {(item: AddressSuggestion) => (
                            <ComboboxItem key={item.id} value={item}>
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
                            </ComboboxItem>
                        )}
                    </ComboboxCollection>
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}
