import { Badge } from "@tihlde/ui/ui/badge";
import { Input } from "@tihlde/ui/ui/input";
import { XIcon } from "lucide-react";
import { useMemo, useState } from "react";

export type AllergyOption = {
    slug: string;
    label: string;
};

type AdminAllergyPickerProps = {
    /** The whole allergy catalogue. */
    options: AllergyOption[];
    /** Selected allergy slugs. */
    selected: string[];
    onChange: (slugs: string[]) => void;
    disabled?: boolean;
};

/** How many matches to show at once — the catalogue is ~200 entries long. */
const MAX_SUGGESTIONS = 8;

/**
 * Multi-select for allergies: chips for what is chosen, a search field for
 * everything else.
 *
 * A plain list rather than a popover because this lives inside a dialog, and
 * the catalogue is far too long (Lepton's free-text answers were imported as
 * one row each) for a checkbox list.
 */
export function AdminAllergyPicker({
    options,
    selected,
    onChange,
    disabled = false,
}: AdminAllergyPickerProps) {
    const [query, setQuery] = useState("");

    const bySlug = useMemo(
        () => new Map(options.map((option) => [option.slug, option])),
        [options],
    );

    const suggestions = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const chosen = new Set(selected);
        return options
            .filter(
                (option) =>
                    !chosen.has(option.slug) &&
                    (needle === "" ||
                        option.label.toLowerCase().includes(needle)),
            )
            .slice(0, MAX_SUGGESTIONS);
    }, [options, selected, query]);

    return (
        <div className="flex flex-col gap-2">
            {selected.length > 0 ? (
                <ul className="flex flex-wrap gap-1">
                    {selected.map((slug) => (
                        <li key={slug}>
                            <Badge variant="secondary" className="gap-1">
                                {bySlug.get(slug)?.label ?? slug}
                                <button
                                    type="button"
                                    disabled={disabled}
                                    aria-label={`Fjern ${bySlug.get(slug)?.label ?? slug}`}
                                    onClick={() =>
                                        onChange(
                                            selected.filter((s) => s !== slug),
                                        )
                                    }
                                >
                                    <XIcon className="size-3" />
                                </button>
                            </Badge>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Ingen allergier registrert.
                </p>
            )}

            <Input
                value={query}
                disabled={disabled}
                placeholder="Søk etter allergi…"
                onChange={(event) => setQuery(event.target.value)}
            />

            {suggestions.length > 0 ? (
                <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                    {suggestions.map((option) => (
                        <li key={option.slug}>
                            <button
                                type="button"
                                disabled={disabled}
                                className="w-full p-1 text-left text-sm"
                                onClick={() => {
                                    onChange([...selected, option.slug]);
                                    setQuery("");
                                }}
                            >
                                {option.label}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : query.trim() !== "" ? (
                <p className="text-sm text-muted-foreground">Ingen treff.</p>
            ) : null}
        </div>
    );
}
