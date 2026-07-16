import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@tihlde/ui/ui/chart";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

import { ChartCard } from "#/components/chart-card";

type GroupStudyRadarChartProps = {
    className?: string;
    data: Array<Record<string, unknown>>;
    config: ChartConfig;
};

export function GroupStudyRadarChart({
    className,
    data,
    config,
}: GroupStudyRadarChartProps) {
    return (
        <ChartCard
            className={className}
            title="Programfordeling"
            description="V26"
        >
            <ChartContainer config={config} className="aspect-square w-full">
                <RadarChart
                    data={data}
                    margin={{ top: 16, bottom: 16, left: 32, right: 32 }}
                    outerRadius="70%"
                >
                    <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="line" />}
                    />
                    <PolarAngleAxis dataKey="studie" />
                    <PolarGrid radialLines={false} />
                    <Radar
                        dataKey="v26"
                        fill="var(--color-v26)"
                        fillOpacity={0.2}
                        stroke="var(--color-v26)"
                        strokeWidth={2}
                    />
                </RadarChart>
            </ChartContainer>
        </ChartCard>
    );
}
