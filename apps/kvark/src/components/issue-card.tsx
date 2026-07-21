import { Card, CardHeader, CardTitle } from "@tihlde/ui/ui/card";

export type IssueCardProps = {
    title: string;
    edition: string;
    coverUrl?: string;
    pdfUrl?: string;
};

export function IssueCard({
    title,
    edition,
    coverUrl,
    pdfUrl,
}: IssueCardProps) {
    const card = (
        <Card size="sm">
            <div className="aspect-[3/4] w-full overflow-hidden">
                {coverUrl ? (
                    <img
                        src={coverUrl}
                        alt={title}
                        className="size-full object-cover"
                        loading="lazy"
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

    if (!pdfUrl) return card;

    return (
        <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            // The card already shows the title, so the link is named for what
            // it does instead of repeating the heading to a screen reader.
            aria-label={`Les ${title} (PDF, åpnes i ny fane)`}
        >
            {card}
        </a>
    );
}
