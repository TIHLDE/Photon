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
import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";

import type { FormStudySlice } from "#/lib/form";

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

type FormStudyChartsProps = {
    cohorts: FormStudySlice[];
    programs: FormStudySlice[];
    /** Antall svar fordelingene er regnet ut av. */
    total: number;
};

export function FormStudyCharts({
    cohorts,
    programs,
    total,
}: FormStudyChartsProps) {
    if (total === 0) {
        return null;
    }

    const description = `${total} svar`;

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <FormStudyDonut
                title="Kull"
                description={description}
                slices={cohorts}
            />
            <FormStudyDonut
                title="Studieretning"
                description={description}
                slices={programs}
            />
        </div>
    );
}
