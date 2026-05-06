import { Input } from "@tihlde/ui/ui/input";
import { Label } from "@tihlde/ui/ui/label";
import { RadioGroup, RadioGroupItem } from "@tihlde/ui/ui/radio-group";
import { useMemo } from "react";

import { FilterCheckboxOption } from "#/components/filter-checkbox-option";
import { type FilterPill } from "#/components/filter-pill-row";
import { FilterShell } from "#/components/filter-shell";

export type JobType = "sommerjobb" | "deltid" | "fulltid" | "annet";

export type JobFiltersValue = {
    query: string;
    classLevels: number[];
    jobType: JobType | null;
};

export const DEFAULT_JOB_FILTERS: JobFiltersValue = {
    query: "",
    classLevels: [],
    jobType: null,
};

type Option<T> = { value: T; label: string };

type JobFiltersProps = {
    value: JobFiltersValue;
    classLevelOptions: Option<number>[];
    jobTypeOptions: Option<JobType>[];
    onChange: (next: JobFiltersValue) => void;
    onSubmit: () => void;
};

export function JobFilters({
    value,
    classLevelOptions,
    jobTypeOptions,
    onChange,
    onSubmit,
}: JobFiltersProps) {
    const toggleClassLevel = (level: number, checked: boolean) => {
        const next = checked
            ? [...value.classLevels, level]
            : value.classLevels.filter((l) => l !== level);
        onChange({ ...value, classLevels: next });
    };

    const pills = useMemo<FilterPill[]>(() => {
        const next: FilterPill[] = [];
        if (value.query) {
            next.push({
                key: "query",
                label: `Søk: ${value.query}`,
                clear: () => onChange({ ...value, query: "" }),
            });
        }
        for (const level of value.classLevels) {
            const opt = classLevelOptions.find((o) => o.value === level);
            next.push({
                key: `class-${level}`,
                label: opt?.label ?? `${level}. klasse`,
                clear: () =>
                    onChange({
                        ...value,
                        classLevels: value.classLevels.filter(
                            (l) => l !== level,
                        ),
                    }),
            });
        }
        if (value.jobType) {
            const opt = jobTypeOptions.find((o) => o.value === value.jobType);
            next.push({
                key: "jobType",
                label: opt?.label ?? value.jobType,
                clear: () => onChange({ ...value, jobType: null }),
            });
        }
        return next;
    }, [value, classLevelOptions, jobTypeOptions, onChange]);

    return (
        <FilterShell
            searchSlot={
                <Input
                    placeholder="Søk etter tittel, firma..."
                    value={value.query}
                    onChange={(e) =>
                        onChange({ ...value, query: e.target.value })
                    }
                />
            }
            fieldsSlot={
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <span className="text-sm">Klassetrinn</span>
                        <div className="flex flex-col gap-2">
                            {classLevelOptions.map((opt) => (
                                <FilterCheckboxOption
                                    key={opt.value}
                                    title={opt.label}
                                    checked={value.classLevels.includes(
                                        opt.value,
                                    )}
                                    onCheckedChange={(checked) =>
                                        toggleClassLevel(opt.value, checked)
                                    }
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-sm">Jobbtype</span>
                        <RadioGroup
                            value={value.jobType ?? ""}
                            onValueChange={(v) =>
                                onChange({
                                    ...value,
                                    jobType: (v as JobType) || null,
                                })
                            }
                            className="flex flex-col gap-2"
                        >
                            {jobTypeOptions.map((opt) => (
                                <Label
                                    key={opt.value}
                                    className="flex items-center gap-2"
                                >
                                    <RadioGroupItem value={opt.value} />
                                    {opt.label}
                                </Label>
                            ))}
                        </RadioGroup>
                    </div>
                </div>
            }
            pills={pills}
            onClearAll={() => onChange(DEFAULT_JOB_FILTERS)}
            onSubmit={onSubmit}
        />
    );
}
