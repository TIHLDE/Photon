import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

type ChartCardProps = {
    title: string;
    description?: string;
    trend?: string;
    className?: string;
    children: ReactNode;
};

export function ChartCard({
    title,
    description,
    trend,
    className,
    children,
}: ChartCardProps) {
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description ? (
                    <CardDescription>{description}</CardDescription>
                ) : null}
                {trend ? (
                    <CardAction>
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                            {trend}
                            <TrendingUp className="size-4" />
                        </span>
                    </CardAction>
                ) : null}
            </CardHeader>
            <CardContent className="flex-1">{children}</CardContent>
        </Card>
    );
}
