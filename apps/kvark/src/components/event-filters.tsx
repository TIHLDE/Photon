import { Input } from "@tihlde/ui/ui/input";
import { Label } from "@tihlde/ui/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { useMemo } from "react";

import { FilterCheckboxOption } from "#/components/filter-checkbox-option";
import { type FilterPill } from "#/components/filter-pill-row";
import { FilterShell } from "#/components/filter-shell";

export type Category = { value: string; label: string };

export type EventFiltersValue = {
    query: string;
    category: string;
    showPast: boolean;
    openRegistration: boolean;
};

export const DEFAULT_EVENT_FILTERS: EventFiltersValue = {
    query: "",
    category: "all",
    showPast: false,
    openRegistration: false,
};

type EventFiltersProps = {
    value: EventFiltersValue;
    categories: Category[];
    onChange: (next: EventFiltersValue) => void;
    onSubmit: () => void;
};

export function EventFilters({
    value,
    categories,
    onChange,
    onSubmit,
}: EventFiltersProps) {
    const pills = useMemo<FilterPill[]>(() => {
        const next: FilterPill[] = [];
        if (value.query) {
            next.push({
                key: "query",
                label: `Søk: ${value.query}`,
                clear: () => onChange({ ...value, query: "" }),
            });
        }
        if (value.category && value.category !== "all") {
            const cat = categories.find((c) => c.value === value.category);
            next.push({
                key: "category",
                label: cat?.label ?? value.category,
                clear: () => onChange({ ...value, category: "all" }),
            });
        }
        if (value.showPast) {
            next.push({
                key: "showPast",
                label: "Tidligere",
                clear: () => onChange({ ...value, showPast: false }),
            });
        }
        if (value.openRegistration) {
            next.push({
                key: "openRegistration",
                label: "Åpen påmelding",
                clear: () => onChange({ ...value, openRegistration: false }),
            });
        }
        return next;
    }, [value, categories, onChange]);

    return (
        <FilterShell
            searchSlot={
                <Input
                    placeholder="Søk etter arrangement"
                    value={value.query}
                    onChange={(e) =>
                        onChange({ ...value, query: e.target.value })
                    }
                />
            }
            fieldsSlot={
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Label>Kategori</Label>
                        <Select
                            value={value.category}
                            onValueChange={(category) =>
                                onChange({ ...value, category: category ?? "" })
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Velg kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>
                                        {c.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-sm">Alternativer</span>
                        <FilterCheckboxOption
                            title="Tidligere"
                            description="Vis tidligere arrangementer"
                            checked={value.showPast}
                            onCheckedChange={(showPast) =>
                                onChange({ ...value, showPast })
                            }
                        />
                        <FilterCheckboxOption
                            title="Åpen påmelding"
                            description="Vis kun arrangementer med åpen påmelding"
                            checked={value.openRegistration}
                            onCheckedChange={(openRegistration) =>
                                onChange({ ...value, openRegistration })
                            }
                        />
                    </div>
                </div>
            }
            pills={pills}
            onClearAll={() => onChange(DEFAULT_EVENT_FILTERS)}
            onSubmit={onSubmit}
        />
    );
}
