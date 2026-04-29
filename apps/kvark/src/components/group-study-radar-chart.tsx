import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@tihlde/ui/ui/chart";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

import { ChartCard } from "#/components/chart-card";
import {
    STUDY_RADAR,
    radarChartConfig,
} from "#/routes/_app/grupper.$slug.mock";

export function GroupStudyRadarChart({ className }: { className?: string }) {
    return (
        <ChartCard
            className={className}
            title="Programfordeling"
            description="V26"
        >
            <ChartContainer
                config={radarChartConfig}
                className="aspect-square w-full"
            >
                <RadarChart
                    data={STUDY_RADAR}
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
