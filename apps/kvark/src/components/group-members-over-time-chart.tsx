import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@tihlde/ui/ui/chart";
import { CartesianGrid, Dot, Line, LineChart } from "recharts";

import { ChartCard } from "#/components/chart-card";
import {
    MEMBERS_OVER_TIME,
    membersChartConfig,
} from "#/routes/_app/grupper.$slug.mock";

export function GroupMembersOverTimeChart({
    className,
}: {
    className?: string;
}) {
    return (
        <ChartCard
            className={className}
            title="Aktive medlemmer"
            description="H22 - V26"
            trend="+4% siste semester"
        >
            <ChartContainer config={membersChartConfig} className="h-32 w-full">
                <LineChart
                    accessibilityLayer
                    data={MEMBERS_OVER_TIME}
                    margin={{ top: 24, left: 24, right: 24 }}
                >
                    <CartesianGrid vertical={false} />
                    <ChartTooltip
                        cursor={false}
                        content={
                            <ChartTooltipContent
                                indicator="line"
                                nameKey="medlemmer"
                                hideLabel
                            />
                        }
                    />
                    <Line
                        dataKey="medlemmer"
                        type="natural"
                        stroke="var(--color-medlemmer)"
                        strokeWidth={2}
                        dot={({ payload, cx, cy }) => (
                            <Dot
                                key={payload.semester}
                                r={5}
                                cx={cx}
                                cy={cy}
                                fill={payload.fill}
                                stroke={payload.fill}
                            />
                        )}
                    />
                </LineChart>
            </ChartContainer>
        </ChartCard>
    );
}
