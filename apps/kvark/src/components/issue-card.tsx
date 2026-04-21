import { Card, CardHeader, CardTitle } from "@tihlde/ui/ui/card";

export type IssueCardProps = {
    title: string;
    edition: string;
    coverUrl?: string;
};

export function IssueCard({ title, edition, coverUrl }: IssueCardProps) {
    return (
        <Card size="sm">
            <div className="aspect-[3/4] w-full overflow-hidden">
                {coverUrl ? (
                    <img
                        src={coverUrl}
                        alt={title}
                        className="size-full object-cover"
                    />
                ) : (
                    <div className="size-full bg-muted" aria-hidden />
                )}
            </div>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <p className="text-muted-foreground">{edition}</p>
            </CardHeader>
        </Card>
    );
}
