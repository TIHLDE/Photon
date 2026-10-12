import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Expand, ImageOff } from "lucide-react";

export type WrappedPhotoTileData = {
    id: string;
    /** Object-URL-en, `undefined` mens den hentes, `null` hvis den feilet. */
    src: string | null | undefined;
    uploaderName: string;
    selected: boolean;
};

type WrappedPhotoGridProps = {
    photos: WrappedPhotoTileData[];
    selectedCount: number;
    totalCount: number;
    hasMore: boolean;
    isLoadingMore: boolean;
    onToggle: (photoId: string, selected: boolean) => void;
    onOpen: (photoId: string) => void;
    onLoadMore: () => void;
};

/**
 * Organisatorens utvalg: et trykk på bildet velger det eller tar det ut, og
 * knappen i hjørnet åpner det stort.
 */
export function WrappedPhotoGrid({
    photos,
    selectedCount,
    totalCount,
    hasMore,
    isLoadingMore,
    onToggle,
    onOpen,
    onLoadMore,
}: WrappedPhotoGridProps) {
    return (
        <div className="flex flex-col gap-4">
            <p>
                {selectedCount} av {totalCount} valgt
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo) => (
                    <WrappedPhotoTile
                        key={photo.id}
                        photo={photo}
                        onToggle={onToggle}
                        onOpen={onOpen}
                    />
                ))}
            </div>
            {hasMore ? (
                <div className="flex justify-center">
                    <Button
                        variant="outline"
                        disabled={isLoadingMore}
                        onClick={onLoadMore}
                    >
                        {isLoadingMore ? "Laster …" : "Last inn flere"}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

function WrappedPhotoTile({
    photo,
    onToggle,
    onOpen,
}: {
    photo: WrappedPhotoTileData;
    onToggle: (photoId: string, selected: boolean) => void;
    onOpen: (photoId: string) => void;
}) {
    const label = `Bilde fra ${photo.uploaderName}`;

    return (
        <Card size="sm" className="relative gap-0 py-0">
            <button
                type="button"
                aria-pressed={photo.selected}
                aria-label={
                    photo.selected
                        ? `${label}, valgt. Trykk for å fjerne fra utvalget`
                        : `${label}. Trykk for å velge`
                }
                onClick={() => onToggle(photo.id, !photo.selected)}
                className="block aspect-[3/4] w-full overflow-hidden"
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
            </button>
            {/*
             * Bare en markør: hele bildet er knappen, så avkrysningsboksen
             * skal verken fanges av tab eller klikk.
             */}
            <Checkbox
                checked={photo.selected}
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none absolute top-2 left-2"
            />
            <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Åpne bildet fra ${photo.uploaderName} i full størrelse`}
                disabled={!photo.src}
                onClick={() => onOpen(photo.id)}
                className="absolute top-2 right-2"
            >
                <Expand />
            </Button>
            <CardContent className="flex min-h-10 items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate">{photo.uploaderName}</span>
                {photo.selected ? <Badge>Valgt</Badge> : null}
            </CardContent>
        </Card>
    );
}
