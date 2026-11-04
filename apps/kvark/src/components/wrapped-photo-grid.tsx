import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@tihlde/ui/ui/toggle-group";
import { CheckCheck, Expand, ImageOff, X } from "lucide-react";
import { type MouseEvent, useRef } from "react";

export type WrappedPhotoGridFilter = "all" | "selected" | "unselected";

const FILTERS: { value: WrappedPhotoGridFilter; label: string }[] = [
    { value: "all", label: "Alle" },
    { value: "selected", label: "Valgt" },
    { value: "unselected", label: "Ikke valgt" },
];

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
    filter: WrappedPhotoGridFilter;
    onFilterChange: (filter: WrappedPhotoGridFilter) => void;
    /** Mens «Marker alle»/«Fjern alle markeringer» lagres. */
    isSelectingAll: boolean;
    onSelectAll: (selected: boolean) => void;
    /** Ett eller flere bilder (Shift-klikk) som skal få samme tilstand. */
    onToggle: (photoIds: string[], selected: boolean) => void;
    onOpen: (photoId: string) => void;
    onLoadMore: () => void;
};

/**
 * Organisatorens utvalg: et trykk på bildet velger det eller tar det ut, og
 * knappen i hjørnet åpner det stort. Shift-klikk gir hele området mellom
 * forrige og dette bildet samme tilstand som bildet man klikket på får.
 */
export function WrappedPhotoGrid({
    photos,
    selectedCount,
    totalCount,
    hasMore,
    isLoadingMore,
    filter,
    onFilterChange,
    isSelectingAll,
    onSelectAll,
    onToggle,
    onOpen,
    onLoadMore,
}: WrappedPhotoGridProps) {
    // Bildet forrige klikk gjaldt, startpunktet for et Shift-klikk.
    const anchorId = useRef<string | null>(null);
    const allSelected = totalCount > 0 && selectedCount === totalCount;

    function handleClick(index: number, event: MouseEvent) {
        const photo = photos[index];
        if (!photo) return;
        const selected = !photo.selected;
        const anchor = event.shiftKey
            ? photos.findIndex((p) => p.id === anchorId.current)
            : -1;
        anchorId.current = photo.id;

        if (anchor === -1) {
            onToggle([photo.id], selected);
            return;
        }
        const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
        const ids = photos
            .slice(from, to + 1)
            .filter((p) => p.selected !== selected)
            .map((p) => p.id);
        onToggle(ids, selected);
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p>
                    {selectedCount} av {totalCount} valgt
                </p>
                <Button
                    variant={allSelected ? "outline" : "default"}
                    disabled={isSelectingAll || totalCount === 0}
                    onClick={() => onSelectAll(!allSelected)}
                >
                    {allSelected ? <X /> : <CheckCheck />}
                    {allSelected ? "Fjern alle markeringer" : "Marker alle"}
                </Button>
            </div>
            <ToggleGroup
                variant="outline"
                size="sm"
                value={[filter]}
                onValueChange={(next) => {
                    const picked = FILTERS.find((f) => f.value === next[0]);
                    if (picked) onFilterChange(picked.value);
                }}
                aria-label="Vis bilder"
            >
                {FILTERS.map(({ value, label }) => (
                    <ToggleGroupItem key={value} value={value}>
                        {label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
            <p className="text-sm text-muted-foreground">
                Trykk på et bilde for å velge det. Hold Shift for å velge alle
                bildene mellom to klikk.
            </p>
            {photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {filter === "selected"
                        ? "Ingen bilder er valgt ennå."
                        : "Alle bildene er valgt."}
                </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo, index) => (
                    <WrappedPhotoTile
                        key={photo.id}
                        photo={photo}
                        onClick={(event) => handleClick(index, event)}
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
    onClick,
    onOpen,
}: {
    photo: WrappedPhotoTileData;
    onClick: (event: MouseEvent) => void;
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
                // Shift-klikk skal velge bilder, ikke tekst på siden.
                onMouseDown={(event) => {
                    if (event.shiftKey) event.preventDefault();
                }}
                onClick={onClick}
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
