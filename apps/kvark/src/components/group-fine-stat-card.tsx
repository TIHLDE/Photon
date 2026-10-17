import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Text } from "@tihlde/ui/ui/text";

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
                <Text render={<span />} size="xs" tone="muted">
                    {label}
                </Text>
                <Text render={<span />} size="2xl" weight="medium">
                    {value}
                </Text>
                <Text render={<span />} size="xs" tone="muted">
                    {perMember} per medlem
                </Text>
            </CardContent>
        </Card>
    );
}
