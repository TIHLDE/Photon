import { Badge } from "@tihlde/ui/ui/badge";
import { Input } from "@tihlde/ui/ui/input";
import { PlusIcon, XIcon } from "lucide-react";
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

/** Hvor mange forslag som vises av gangen. */
const MAX_SUGGESTIONS = 8;

/** Samme grenser som API-et håndhever, så feilen kommer før lagring. */
const MAX_CUSTOM = 15;
const MAX_CUSTOM_LENGTH = 64;

function normalize(value: string) {
    return value.trim().replace(/\s+/g, " ");
}

/**
 * Allergivelger for medlemmet selv: hak av de vanlige, eller skriv inn dine
 * egne.
 *
 * Egendefinerte oppføringer blir ikke nye rader i katalogen. Lepton-importen
 * gjorde nettopp det, og etterlot oss ~200 nesten like rader — så disse lagres
 * på medlemmet i stedet, og katalogen forblir en liste det går an å velge fra.
 *
 * «Ingen allergier» er et eget valg framfor bare en tom liste, fordi tomt ikke
 * skiller de allergifrie fra dem som aldri har sett spørsmålet. Arrangøren
 * trenger den forskjellen.
 */
export function AllergyPicker({
    options,
    value,
    onChange,
    disabled = false,
}: AllergyPickerProps) {
    const [query, setQuery] = useState("");

    const { allergies, customAllergies } = value;
    const isEmpty = allergies.length === 0 && customAllergies.length === 0;

    const bySlug = useMemo(
        () => new Map(options.map((option) => [option.slug, option])),
        [options],
    );

    const trimmed = normalize(query);

    const suggestions = useMemo(() => {
        const needle = trimmed.toLowerCase();
        const chosen = new Set(allergies);
        return options
            .filter(
                (option) =>
                    !chosen.has(option.slug) &&
                    (needle === "" ||
                        option.label.toLowerCase().includes(needle) ||
                        // Søk i eksemplene også: skriver du «laktose» eller
                        // «hasselnøtt», er det Melk og Nøtter du er ute etter,
                        // men ingen av ordene står i etiketten.
                        (option.description ?? "")
                            .toLowerCase()
                            .includes(needle)),
            )
            .slice(0, MAX_SUGGESTIONS);
    }, [options, allergies, trimmed]);

    /**
     * Fritekst tilbys bare når teksten ikke allerede finnes som et kuratert
     * valg — ellers ville man endt opp med «Nøtter» to ganger, én av dem
     * usynlig for opptellingen arrangøren får.
     */
    const canAddCustom =
        trimmed !== "" &&
        customAllergies.length < MAX_CUSTOM &&
        !options.some(
            (option) => option.label.toLowerCase() === trimmed.toLowerCase(),
        ) &&
        !customAllergies.some(
            (entry) => entry.toLowerCase() === trimmed.toLowerCase(),
        );

    function addCustom() {
        if (!canAddCustom) return;
        onChange({
            allergies,
            customAllergies: [
                ...customAllergies,
                trimmed.slice(0, MAX_CUSTOM_LENGTH),
            ],
        });
        setQuery("");
    }

    return (
        <div className="flex flex-col gap-2">
            {isEmpty ? (
                <ul className="flex flex-wrap gap-1">
                    <li>
                        <Badge variant="secondary">Ingen allergier</Badge>
                    </li>
                </ul>
            ) : (
                <ul className="flex flex-wrap gap-1">
                    {allergies.map((slug) => {
                        const label = bySlug.get(slug)?.label ?? slug;
                        return (
                            <li key={slug}>
                                <Badge variant="secondary" className="gap-1">
                                    {label}
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        aria-label={`Fjern ${label}`}
                                        onClick={() =>
                                            onChange({
                                                allergies: allergies.filter(
                                                    (s) => s !== slug,
                                                ),
                                                customAllergies,
                                            })
                                        }
                                    >
                                        <XIcon className="size-3" />
                                    </button>
                                </Badge>
                            </li>
                        );
                    })}
                    {customAllergies.map((entry) => (
                        <li key={entry}>
                            <Badge variant="outline" className="gap-1">
                                {entry}
                                <button
                                    type="button"
                                    disabled={disabled}
                                    aria-label={`Fjern ${entry}`}
                                    onClick={() =>
                                        onChange({
                                            allergies,
                                            customAllergies:
                                                customAllergies.filter(
                                                    (e) => e !== entry,
                                                ),
                                        })
                                    }
                                >
                                    <XIcon className="size-3" />
                                </button>
                            </Badge>
                        </li>
                    ))}
                </ul>
            )}

            <Input
                value={query}
                disabled={disabled}
                placeholder="Søk, eller skriv inn din egen…"
                maxLength={MAX_CUSTOM_LENGTH}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    // Uten dette sender Enter skjemaet i stedet for å legge
                    // til det man nettopp skrev.
                    event.preventDefault();
                    addCustom();
                }}
            />

            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {canAddCustom ? (
                    <li>
                        <button
                            type="button"
                            disabled={disabled}
                            className="flex w-full items-center gap-2 p-1 text-left text-sm"
                            onClick={addCustom}
                        >
                            <PlusIcon className="size-3 shrink-0" />
                            Legg til «{trimmed}»
                        </button>
                    </li>
                ) : null}

                {/* Vises bare når det er noe å nullstille. Er lista allerede
                    tom, er «ingen allergier» tilstanden man står i. */}
                {!isEmpty && trimmed === "" ? (
                    <li>
                        <button
                            type="button"
                            disabled={disabled}
                            className="w-full p-1 text-left text-sm"
                            onClick={() => {
                                onChange({
                                    allergies: [],
                                    customAllergies: [],
                                });
                                setQuery("");
                            }}
                        >
                            Ingen allergier
                        </button>
                    </li>
                ) : null}

                {suggestions.map((option) => (
                    <li key={option.slug}>
                        <button
                            type="button"
                            disabled={disabled}
                            className="flex w-full flex-col gap-0.5 p-1 text-left text-sm"
                            onClick={() => {
                                onChange({
                                    allergies: [...allergies, option.slug],
                                    customAllergies,
                                });
                                setQuery("");
                            }}
                        >
                            <span>{option.label}</span>
                            {/* Mattilsynets egne eksempler. De færreste vet at
                                worcestersaus inneholder fisk, så det er dette
                                som gjør at folk kjenner igjen sitt eget. */}
                            {option.description ? (
                                <span className="text-xs text-muted-foreground">
                                    {option.description}
                                </span>
                            ) : null}
                        </button>
                    </li>
                ))}
            </ul>

            {customAllergies.length >= MAX_CUSTOM ? (
                <p className="text-sm text-muted-foreground">
                    Du kan ha inntil {MAX_CUSTOM} egendefinerte allergier.
                </p>
            ) : null}
        </div>
    );
}
