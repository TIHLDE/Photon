import { type ReactElement, type ReactNode, cloneElement } from "react";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardDescription } from "@tihlde/ui/ui/card";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Camera, ImageOff } from "lucide-react";

export type WrappedMyPhotoTile = {
    id: string;
    /** Nummeret i rekkefølgen bildene ble tatt, fra 1. */
    number: number;
    /** Object-URL-en, `undefined` mens den hentes, `null` hvis den feilet. */
    src: string | null | undefined;
    fromCameraRoll: boolean;
    submitted: boolean;
};

type WrappedMyPhotosProps = {
    photos: WrappedMyPhotoTile[];
    shotsLeft: number;
    draftCount: number;
    /** Når bildene sendes til arrangøren: `HH:mm`. */
    closesAt: string;
    /** Lenken tilbake til kameraet, som `<Link />`. */
    cameraLink: ReactElement;
    /** Lenken til bildet i full skjerm, som `<Link />`. */
    photoLink: (
        photoId: string,
    ) => ReactElement<{ className?: string; children?: ReactNode }>;
};

/**
 * Mine bilder: det medlemmet selv har tatt. Bildene er medlemmets egne til
 * kameraet stenger, og kan slettes fram til da.
 */
export function WrappedMyPhotos({
    photos,
    shotsLeft,
    draftCount,
    closesAt,
    cameraLink,
    photoLink,
}: WrappedMyPhotosProps) {
    if (photos.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Camera />
                    </EmptyMedia>
                    <EmptyTitle>Ingen bilder ennå</EmptyTitle>
                    <EmptyDescription>
                        Bildene du tar, havner her. De sendes automatisk til
                        arrangøren når kameraet stenger.
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button
                        size="lg"
                        render={cameraLink}
                        className="min-h-16 w-full"
                    >
                        <Camera />
                        Ta bilde
                    </Button>
                </EmptyContent>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <p>
                Bare du ser disse til kameraet stenger. Trykk på et bilde for å
                se det eller slette det.
            </p>
            <ul className="grid grid-cols-2 gap-3">
                {photos.map((photo) => (
                    <li key={photo.id}>
                        {cloneElement(
                            photoLink(photo.id),
                            { className: "block" },
                            <MyPhotoTile photo={photo} />,
                        )}
                    </li>
                ))}
                {shotsLeft > 0 ? (
                    <li>
                        <Button
                            variant="outline"
                            render={cameraLink}
                            className="h-50 w-full flex-col"
                        >
                            <Camera />
                            {shotsLeft} {shotsLeft === 1 ? "bilde" : "bilder"}{" "}
                            igjen
                        </Button>
                    </li>
                ) : null}
            </ul>
            {draftCount > 0 ? (
                <Card size="sm">
                    <CardContent>
                        <CardDescription>
                            Bildene sendes automatisk til arrangøren kl.{" "}
                            {closesAt}. Til da kan du slette dem du ikke vil
                            dele.
                        </CardDescription>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}

function MyPhotoTile({ photo }: { photo: WrappedMyPhotoTile }) {
    return (
        <Card
            size="sm"
            className="relative h-50 gap-0 overflow-hidden py-0"
            // Uten en rolle leser ikke skjermlesere etiketten på et kort. Merkene
            // inni blir da skjult, så etiketten sier det samme som dem.
            role="img"
            aria-label={`Bilde ${photo.number}, ${photo.fromCameraRoll ? "fra kamerarullen, " : ""}${photo.submitted ? "sendt til arrangøren" : "bare synlig for deg"}`}
        >
            {photo.src ? (
                <img
                    src={photo.src}
                    alt=""
                    decoding="async"
                    className="block size-full object-cover"
                />
            ) : photo.src === null ? (
                <span className="flex size-full items-center justify-center">
                    <ImageOff />
                </span>
            ) : (
                <Skeleton className="size-full" />
            )}
            <Badge className="absolute top-2 left-2">{photo.number}</Badge>
            <span className="absolute right-2 bottom-2 left-2 flex flex-wrap justify-end gap-1">
                {photo.fromCameraRoll ? (
                    <Badge variant="secondary">Kamerarull</Badge>
                ) : null}
                {photo.submitted ? <Badge>Sendt</Badge> : null}
            </span>
        </Card>
    );
}

export function WrappedMyPhotosSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-3/4" />
            <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-50 w-full" />
                <Skeleton className="h-50 w-full" />
                <Skeleton className="h-50 w-full" />
            </div>
        </div>
    );
}
