import { Card, CardContent } from "@tihlde/ui/ui/card";

type GroupFineStatCardProps = {
    label: string;
    value: number | string;
    perMember: number | string;
};

export function GroupFineStatCard({
    label,
    value,
    perMember,
}: GroupFineStatCardProps) {
    return (
        <Card size="sm">
            <CardContent className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-2xl font-medium">{value}</span>
                <span className="text-xs text-muted-foreground">
                    {perMember} per medlem
                </span>
            </CardContent>
        </Card>
    );
}
