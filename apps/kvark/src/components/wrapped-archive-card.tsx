import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Images } from "lucide-react";
import type { ReactElement } from "react";
import { formatOsloDate } from "#/lib/date";

type WrappedArchiveCardProps = {
    title: string;
    start: string;
    photoCount: number;
    myPhotoCount: number;
    /**
     * Object-URL-en til forsidebildet. `undefined` mens det hentes, `null`
     * når storyen ikke har noe bilde eller hentingen feilet.
     */
    coverUrl: string | null | undefined;
    /** Lenken kortet åpner, typisk storyen. */
    link: ReactElement;
};

function photoCountLabel(count: number): string {
    return count === 1 ? "1 bilde" : `${count} bilder`;
}

/** Én story i arkivet: forsidebildet, arrangementet og hvor mange bilder. */
export function WrappedArchiveCard({
    title,
    start,
    photoCount,
    myPhotoCount,
    coverUrl,
    link,
}: WrappedArchiveCardProps) {
    return (
        <Card size="sm" render={link}>
            <div
                data-slot="card-media"
                className="aspect-4/5 w-full overflow-hidden bg-muted"
            >
                {coverUrl === undefined ? (
                    <Skeleton className="size-full" />
                ) : coverUrl === null ? (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                        <Images aria-hidden />
                    </div>
                ) : (
                    <img
                        src={coverUrl}
                        alt=""
                        className="size-full object-cover"
                    />
                )}
            </div>
            <CardContent className="flex flex-col gap-1">
                <span className="truncate font-medium">{title}</span>
                <p className="text-muted-foreground">
                    {formatOsloDate(start, { dateStyle: "long" })}
                </p>
                <p className="text-muted-foreground">
                    {photoCountLabel(photoCount)}
                    {myPhotoCount > 0 ? ` · ${myPhotoCount} av dine` : null}
                </p>
            </CardContent>
        </Card>
    );
}

/** Plassholderen mens arkivet lastes, i samme rutenett som kortene. */
export function WrappedArchiveGridSkeleton() {
    return (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
                <li key={i} className="flex flex-col gap-2">
                    <Skeleton className="aspect-4/5 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </li>
            ))}
        </ul>
    );
}
