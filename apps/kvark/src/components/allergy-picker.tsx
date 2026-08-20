import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxCollection,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
} from "@tihlde/ui/ui/combobox";
import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

export type AllergyOption = {
    slug: string;
    label: string;
    description?: string | null;
};

export type AllergySelection = {
    /** Slugs fra den kuraterte katalogen. */
    allergies: string[];
    /** Det medlemmet har skrevet inn selv. */
    customAllergies: string[];
};

type AllergyPickerProps = {
    /** Kun de kuraterte valgene — ikke hele katalogen. */
    options: AllergyOption[];
    value: AllergySelection;
    onChange: (value: AllergySelection) => void;
    disabled?: boolean;
};

/** Samme grenser som API-et håndhever, så feilen kommer før lagring. */
const MAX_CUSTOM = 15;
const MAX_CUSTOM_LENGTH = 64;

/**
 * Ett felles element uansett om valget kom fra katalogen eller ble skrevet
 * inn. Comboboxen må ha én type å jobbe med, og `kind` avgjør hvor verdien
 * havner igjen når utvalget leveres tilbake.
 *
 * `create` er raden «Legg til …». Den er aldri en verdi, bare et forslag som
 * blir til et `custom`-element i det man velger det.
 */
type AllergyItem = {
    kind: "curated" | "custom" | "create";
    /** Slug for kuraterte, selve teksten for de andre. */
    key: string;
    label: string;
    description?: string | null;
};

function normalize(value: string) {
    return value.trim().replace(/\s+/g, " ");
}

function itemLabel(item: AllergyItem) {
    return item.label;
}

function itemsEqual(a: AllergyItem, b: AllergyItem) {
    return a.kind === b.kind && a.key === b.key;
}

/**
 * Allergivelger for medlemmet selv: en flervalgs nedtrekksliste der man også
 * kan skrive inn sine egne.
 *
 * Egendefinerte oppføringer blir ikke nye rader i katalogen. Lepton-importen
 * gjorde nettopp det, og etterlot oss ~200 nesten like rader — så disse lagres
 * på medlemmet i stedet, og katalogen forblir en liste det går an å velge fra.
 *
 * «Ingen allergier» er ikke et element her: tomt utvalg *er* svaret, og
 * bekreftelsen ligger i at man lagrer.
 */
export function AllergyPicker({
    options,
    value,
    onChange,
    disabled = false,
}: AllergyPickerProps) {
    const [query, setQuery] = useState("");
    const anchor = useComboboxAnchor();

    const { allergies, customAllergies } = value;

    const bySlug = useMemo(
        () => new Map(options.map((option) => [option.slug, option])),
        [options],
    );

    /** Utvalget slik comboboxen vil ha det. */
    const selected = useMemo<AllergyItem[]>(
        () => [
            ...allergies.map((slug) => ({
                kind: "curated" as const,
                key: slug,
                label: bySlug.get(slug)?.label ?? slug,
                description: bySlug.get(slug)?.description,
            })),
            ...customAllergies.map((entry) => ({
                kind: "custom" as const,
                key: entry,
                label: entry,
            })),
        ],
        [allergies, customAllergies, bySlug],
    );

    const trimmed = normalize(query);
    const needle = trimmed.toLowerCase();

    /**
     * Fritekst tilbys bare når teksten ikke allerede finnes som et kuratert
     * valg — ellers ville man endt opp med «Nøtter» to ganger, én av dem
     * usynlig for opptellingen arrangøren får.
     */
    const canCreate =
        trimmed !== "" &&
        customAllergies.length < MAX_CUSTOM &&
        !options.some((option) => option.label.toLowerCase() === needle) &&
        !customAllergies.some((entry) => entry.toLowerCase() === needle);

    // Filtreringen gjøres her, ikke av comboboxen, fordi «Legg til …» skal
    // stå nederst uansett hva søket treffer.
    const items = useMemo<AllergyItem[]>(() => {
        const matches = options
            .filter(
                (option) =>
                    needle === "" ||
                    option.label.toLowerCase().includes(needle) ||
                    // Søk i eksemplene også: skriver du «laktose» eller
                    // «hasselnøtt», er det Melk og Nøtter du er ute etter,
                    // men ingen av ordene står i etiketten.
                    (option.description ?? "").toLowerCase().includes(needle),
            )
            .map((option) => ({
                kind: "curated" as const,
                key: option.slug,
                label: option.label,
                description: option.description,
            }));

        return canCreate
            ? [
                  ...matches,
                  { kind: "create" as const, key: trimmed, label: trimmed },
              ]
            : matches;
    }, [options, needle, canCreate, trimmed]);

    function handleValueChange(next: AllergyItem[]) {
        const picked = next.map((item) =>
            item.kind === "create"
                ? {
                      kind: "custom" as const,
                      key: item.label.slice(0, MAX_CUSTOM_LENGTH),
                      label: item.label.slice(0, MAX_CUSTOM_LENGTH),
                  }
                : item,
        );

        onChange({
            allergies: picked
                .filter((item) => item.kind === "curated")
                .map((item) => item.key),
            customAllergies: picked
                .filter((item) => item.kind === "custom")
                .map((item) => item.key),
        });

        // Tøm søket, ellers står teksten igjen og skjuler resten av lista.
        setQuery("");
    }

    return (
        <Combobox
            multiple
            items={items}
            value={selected}
            onValueChange={handleValueChange}
            inputValue={query}
            onInputValueChange={setQuery}
            disabled={disabled}
            // Uten dette åpner lista seg først når man begynner å skrive, og
            // et tomt felt gir ingen antydning om at det finnes valg.
            openOnInputClick
            // Vi har allerede filtrert, og «Legg til …» skal overleve.
            filter={null}
            itemToStringLabel={itemLabel}
            isItemEqualToValue={itemsEqual}
        >
            <ComboboxChips ref={anchor}>
                <ComboboxValue>
                    {(chips: AllergyItem[]) => (
                        <>
                            {chips.map((item) => (
                                <ComboboxChip key={`${item.kind}:${item.key}`}>
                                    {item.label}
                                </ComboboxChip>
                            ))}
                            <ComboboxChipsInput
                                placeholder={
                                    chips.length === 0
                                        ? "Velg eller skriv inn allergier…"
                                        : undefined
                                }
                            />
                        </>
                    )}
                </ComboboxValue>
            </ComboboxChips>

            <ComboboxContent anchor={anchor}>
                <ComboboxList>
                    <ComboboxEmpty>Ingen treff</ComboboxEmpty>
                    <ComboboxCollection>
                        {(item: AllergyItem) => (
                            <ComboboxItem
                                key={`${item.kind}:${item.key}`}
                                value={item}
                            >
                                {item.kind === "create" ? (
                                    <span className="flex items-center gap-2">
                                        <PlusIcon className="size-3 shrink-0" />
                                        Legg til «{item.label}»
                                    </span>
                                ) : (
                                    <span className="flex flex-col gap-0.5">
                                        <span>{item.label}</span>
                                        {/* Mattilsynets egne eksempler. De
                                            færreste vet at worcestersaus
                                            inneholder fisk. */}
                                        {item.description ? (
                                            <span className="text-xs text-muted-foreground">
                                                {item.description}
                                            </span>
                                        ) : null}
                                    </span>
                                )}
                            </ComboboxItem>
                        )}
                    </ComboboxCollection>
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}
