import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Input } from "@tihlde/ui/ui/input";
import { Label } from "@tihlde/ui/ui/label";
import { RadioGroup, RadioGroupItem } from "@tihlde/ui/ui/radio-group";
import { Search } from "lucide-react";

export type JobType = "sommerjobb" | "deltid" | "fulltid" | "annet";

export type JobFiltersValue = {
    query: string;
    classLevels: number[];
    jobType: JobType | null;
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Filter</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSubmit();
                    }}
                >
                    <Input
                        placeholder="Søk etter tittel, firma..."
                        value={value.query}
                        onChange={(e) =>
                            onChange({ ...value, query: e.target.value })
                        }
                    />
                    <Button type="submit" size="icon" aria-label="Søk">
                        <Search />
                    </Button>
                </form>

                <div className="flex flex-col gap-2">
                    <span className="text-sm">Klassetrinn</span>
                    <div className="flex flex-col gap-2">
                        {classLevelOptions.map((opt) => (
                            <Label
                                key={opt.value}
                                className="justify-start gap-2"
                            >
                                <Checkbox
                                    checked={value.classLevels.includes(
                                        opt.value,
                                    )}
                                    onCheckedChange={(checked) =>
                                        toggleClassLevel(
                                            opt.value,
                                            checked === true,
                                        )
                                    }
                                />
                                {opt.label}
                            </Label>
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
                                className="justify-start gap-2"
                            >
                                <RadioGroupItem value={opt.value} />
                                {opt.label}
                            </Label>
                        ))}
                    </RadioGroup>
                </div>
            </CardContent>
        </Card>
    );
}
