import type { ReactElement } from "react";
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
import { Spinner } from "@tihlde/ui/ui/spinner";
import { Camera, ImageOff, Send } from "lucide-react";

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
    /** Når usendte bilder slettes: `HH:mm`. */
    closesAt: string;
    /** Lenken tilbake til kameraet, som `<Link />`. */
    cameraLink: ReactElement;
    isSubmitting: boolean;
    onSubmit: () => void;
};

/**
 * Mine bilder: det medlemmet selv har tatt, før noen andre ser det. Utkast
 * sendes inn med ett trykk.
 */
export function WrappedMyPhotos({
    photos,
    shotsLeft,
    draftCount,
    closesAt,
    cameraLink,
    isSubmitting,
    onSubmit,
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
                        Bildene du tar, havner her til du sender dem inn.
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
            <p>Bare du ser disse til du sender dem inn.</p>
            <ul className="grid grid-cols-2 gap-3">
                {photos.map((photo) => (
                    <li key={photo.id}>
                        <MyPhotoTile photo={photo} />
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
                // Over bunnlinja på mobil, så knappen alltid er innen rekkevidde.
                <Card size="sm" className="sticky bottom-20 lg:bottom-4">
                    <CardContent className="flex flex-col gap-2">
                        <Button
                            size="lg"
                            className="min-h-16 w-full"
                            disabled={isSubmitting}
                            onClick={onSubmit}
                        >
                            {isSubmitting ? <Spinner /> : <Send />}
                            Send inn {draftCount}{" "}
                            {draftCount === 1 ? "bilde" : "bilder"}
                        </Button>
                        <CardDescription>
                            Bilder som ikke er sendt inn før kl. {closesAt},
                            slettes.
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
            aria-label={`Bilde ${photo.number}, ${photo.submitted ? "sendt" : "ikke sendt"}`}
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
