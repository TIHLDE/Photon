import { Card, CardContent } from "@tihlde/ui/ui/card";

export type ProfileStatCardProps = {
    label: string;
    title: string;
    description: string;
};

export function ProfileStatCard({
    label,
    title,
    description,
}: ProfileStatCardProps) {
    return (
        <Card size="sm">
            <CardContent className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="font-medium">{title}</span>
                <span className="text-sm text-muted-foreground">
                    {description}
                </span>
            </CardContent>
        </Card>
    );
}
