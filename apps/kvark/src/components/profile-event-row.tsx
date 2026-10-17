import { Badge } from "@tihlde/ui/ui/badge";
import { Card } from "@tihlde/ui/ui/card";
import { Text } from "@tihlde/ui/ui/text";

export type ProfileEventRowProps = {
    title: string;
    meta: string;
    status: string;
    statusVariant: "default" | "secondary" | "outline";
};

export function ProfileEventRow({
    title,
    meta,
    status,
    statusVariant,
}: ProfileEventRowProps) {
    return (
        <Card size="sm" className="flex-row items-center gap-3">
            <div
                className="ml-3 size-10 shrink-0 rounded-md bg-muted"
                aria-hidden
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <Text render={<span />} weight="medium" className="truncate">
                    {title}
                </Text>
                <Text
                    render={<span />}
                    size="sm"
                    tone="muted"
                    className="truncate"
                >
                    {meta}
                </Text>
            </div>
            <div className="pr-3">
                <Badge variant={statusVariant}>{status}</Badge>
            </div>
        </Card>
    );
}
