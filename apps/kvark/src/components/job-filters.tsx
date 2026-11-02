import { Input } from "@tihlde/ui/ui/input";
import { useMemo } from "react";

import { FilterCheckboxOption } from "#/components/filter-checkbox-option";
import { type FilterPill } from "#/components/filter-pill-row";
import { FilterShell } from "#/components/filter-shell";
import { truncateLabel } from "#/lib/utils";

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
};

export function JobFilters({
    value,
    classLevelOptions,
    jobTypeOptions,
    onChange,
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
                label: `Søk: ${truncateLabel(value.query)}`,
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
                        <div className="flex flex-col gap-2">
                            {jobTypeOptions.map((opt) => (
                                <FilterCheckboxOption
                                    key={opt.value}
                                    title={opt.label}
                                    checked={value.jobType === opt.value}
                                    onCheckedChange={(checked) =>
                                        onChange({
                                            ...value,
                                            jobType: checked ? opt.value : null,
                                        })
                                    }
                                />
                            ))}
                        </div>
                    </div>
                </div>
            }
            pills={pills}
            onClearAll={() => onChange(DEFAULT_JOB_FILTERS)}
        />
    );
}
