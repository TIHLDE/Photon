import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@tihlde/ui/ui/chart";
import { Label } from "@tihlde/ui/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";

import {
    type FormStudyCountMode,
    type FormStudySlice,
    type FormSubmissionRow,
    summarizeFormStudy,
} from "#/lib/form";

/**
 * Faste farger med god avstand i fargesirkelen, så nabosektorer er lette å
 * skille. Skalaen i temaet har bare fem trinn av samme farge, som ville gjort
 * et diagram med mange kull uleselig.
 */
const SLICE_COLORS = [
    "oklch(0.62 0.17 250)",
    "oklch(0.70 0.15 160)",
    "oklch(0.75 0.15 75)",
    "oklch(0.62 0.19 20)",
    "oklch(0.62 0.16 305)",
    "oklch(0.70 0.12 200)",
    "oklch(0.66 0.15 340)",
    "oklch(0.72 0.15 120)",
];
/** Restposten «Ukjent» skal ikke konkurrere med de ekte kategoriene. */
const UNKNOWN_COLOR = "oklch(0.65 0.02 260)";

function sliceColor(slice: FormStudySlice, index: number): string {
    return slice.unknown
        ? UNKNOWN_COLOR
        : SLICE_COLORS[index % SLICE_COLORS.length];
}

type FormStudyDonutProps = {
    title: string;
    description: string;
    slices: FormStudySlice[];
};

function FormStudyDonut({ title, description, slices }: FormStudyDonutProps) {
    const config = useMemo<ChartConfig>(
        () =>
            Object.fromEntries(
                slices.map((slice, index) => [
                    slice.key,
                    { label: slice.label, color: sliceColor(slice, index) },
                ]),
            ),
        [slices],
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <ChartContainer
                    config={config}
                    className="mx-auto aspect-square w-full max-w-64"
                >
                    <PieChart>
                        <ChartTooltip
                            content={
                                <ChartTooltipContent nameKey="key" hideLabel />
                            }
                        />
                        <Pie
                            data={slices}
                            dataKey="count"
                            nameKey="key"
                            innerRadius={55}
                            outerRadius={95}
                            paddingAngle={2}
                            strokeWidth={0}
                            isAnimationActive={false}
                        >
                            {slices.map((slice, index) => (
                                <Cell
                                    key={slice.key}
                                    fill={sliceColor(slice, index)}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartContainer>
                <ul className="flex flex-col gap-2">
                    {slices.map((slice, index) => (
                        <li
                            key={slice.key}
                            className="flex items-center gap-2 text-sm"
                        >
                            <span
                                aria-hidden
                                className="size-2.5 shrink-0 rounded-[2px]"
                                style={{
                                    backgroundColor: sliceColor(slice, index),
                                }}
                            />
                            <span className="truncate">{slice.label}</span>
                            <span className="ml-auto font-medium tabular-nums text-muted-foreground">
                                {slice.count} ({slice.percentage} %)
                            </span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

const COUNT_MODES: { value: FormStudyCountMode; label: string }[] = [
    { value: "submissions", label: "Per svar" },
    { value: "people", label: "Per person" },
];

type FormStudyChartsProps = {
    submissions: FormSubmissionRow[];
};

export function FormStudyCharts({ submissions }: FormStudyChartsProps) {
    const [mode, setMode] = useState<FormStudyCountMode>("submissions");
    const distribution = useMemo(
        () => summarizeFormStudy(submissions, mode),
        [submissions, mode],
    );

    if (submissions.length === 0) {
        return null;
    }

    const { total } = distribution;
    const description =
        mode === "people"
            ? `${total} ${total === 1 ? "person" : "personer"}`
            : `${total} svar`;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Label htmlFor="form-study-count-mode">Tell</Label>
                <Select
                    items={COUNT_MODES}
                    value={mode}
                    onValueChange={(value) =>
                        setMode((value as FormStudyCountMode | null) ?? mode)
                    }
                >
                    <SelectTrigger
                        id="form-study-count-mode"
                        className="w-44"
                        aria-label="Hva én andel teller"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {COUNT_MODES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <FormStudyDonut
                    title="Kull"
                    description={description}
                    slices={distribution.cohorts}
                />
                <FormStudyDonut
                    title="Studieretning"
                    description={description}
                    slices={distribution.programs}
                />
            </div>
        </div>
    );
}
