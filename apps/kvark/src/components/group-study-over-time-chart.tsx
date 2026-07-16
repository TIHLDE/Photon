import {
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "@tihlde/ui/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { ChartCard } from "#/components/chart-card";

type GroupStudyOverTimeChartProps = {
    className?: string;
    data: Array<Record<string, unknown>>;
    config: ChartConfig;
};

export function GroupStudyOverTimeChart({
    className,
    data,
    config,
}: GroupStudyOverTimeChartProps) {
    return (
        <ChartCard
            className={className}
            title="Studieprogram over tid"
            description="H22 - V26"
            trend="+12% siste semester"
        >
            <ChartContainer config={config} className="size-full">
                <BarChart accessibilityLayer data={data}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="semester"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                        dataKey="dataingenior"
                        stackId="a"
                        fill="var(--color-dataingenior)"
                        radius={[0, 0, 4, 4]}
                    />
                    <Bar
                        dataKey="forretning"
                        stackId="a"
                        fill="var(--color-forretning)"
                    />
                    <Bar
                        dataKey="infrastruktur"
                        stackId="a"
                        fill="var(--color-infrastruktur)"
                    />
                    <Bar
                        dataKey="transformasjon"
                        stackId="a"
                        fill="var(--color-transformasjon)"
                        radius={[4, 4, 0, 0]}
                    />
                </BarChart>
            </ChartContainer>
        </ChartCard>
    );
}
