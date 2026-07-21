import { Card, CardHeader, CardTitle } from "@tihlde/ui/ui/card";

import { DEFAULT_COVER_IMAGE } from "#/lib/image";

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
            {/*
             * The cover is a direct child on purpose: Card drops its top
             * padding and rounds the top corners only for an `img:first-child`,
             * so wrapping it in an aspect-ratio div left a band of card above
             * the image. The ratio goes on the image itself instead.
             */}
            <img
                src={coverUrl || DEFAULT_COVER_IMAGE}
                alt={title}
                className="aspect-[3/4] w-full object-cover"
                loading="lazy"
            />
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
