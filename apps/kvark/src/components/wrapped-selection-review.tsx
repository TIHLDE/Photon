import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Check, ChevronLeft, ImageOff, PartyPopper, X } from "lucide-react";
import { useEffect, useRef } from "react";

export type WrappedReviewPhoto = {
    id: string;
    /** Flisa fra rutenettet: miniatyren, og bildet mens det store hentes. */
    thumbSrc: string | null | undefined;
    /** Den store versjonen, `undefined` til den er hentet. */
    largeSrc: string | null | undefined;
    uploaderName: string;
    takenAt: string;
    selected: boolean;
};

type WrappedSelectionReviewProps = {
    photos: WrappedReviewPhoto[];
    /** Bildet som vises, eller `null` når man er ferdig med alle. */
    currentId: string | null;
    onCurrentChange: (photoId: string | null) => void;
    onDecide: (photoId: string, selected: boolean) => void;
    onClose: () => void;
    selectedCount: number;
    /** Lista har flere sider på serveren som ikke er hentet ennå. */
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
};

/** Under så mange piksler er en sveip like gjerne en upresis tapp. */
const SWIPE_PX = 50;

/**
 * Gjennomgang av bildene ett og ett i stort format. «Ta med» og «Hopp over»
 * lagrer valget og går rett videre, så arrangøren slipper å åpne og lukke
 * hvert bilde. Tastatur: → / J tar med, ← / K hopper over, Backspace går
 * tilbake. På mobil: sveip til høyre for å ta med, til venstre for å hoppe
 * over.
 */
export function WrappedSelectionReview({
    photos,
    currentId,
    onCurrentChange,
    onDecide,
    onClose,
    selectedCount,
    hasMore,
    isLoadingMore,
    onLoadMore,
}: WrappedSelectionReviewProps) {
    const index =
        currentId === null
            ? photos.length
            : photos.findIndex((p) => p.id === currentId);
    const photo = photos[index] ?? null;
    const touchStartX = useRef<number | null>(null);
    // Gikk vi forbi siste hentede bilde mens neste side lastes, fortsetter vi
    // på bildet etter det når siden kommer. Holder id-en vi stod på.
    const waitingAfter = useRef<{ id: string; count: number } | null>(null);
    const stripRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const after = waitingAfter.current;
        if (after === null || isLoadingMore) return;
        // Ikke før siden faktisk er kommet (eller det viste seg å ikke være
        // flere), ellers ville vi hoppet til «Ferdig» før kallet startet.
        if (photos.length <= after.count && hasMore) return;
        waitingAfter.current = null;
        const at = photos.findIndex((p) => p.id === after.id);
        onCurrentChange(photos[at + 1]?.id ?? null);
    }, [photos, isLoadingMore, hasMore, onCurrentChange]);

    useEffect(() => {
        if (!currentId) return;
        stripRef.current
            ?.querySelector(`[data-photo-id="${currentId}"]`)
            ?.scrollIntoView({ block: "nearest", inline: "center" });
    }, [currentId]);

    function advance() {
        const next = photos[index + 1];
        if (next) {
            onCurrentChange(next.id);
        } else if (hasMore && photo) {
            waitingAfter.current = { id: photo.id, count: photos.length };
            onLoadMore();
        } else {
            onCurrentChange(null);
        }
    }

    function decide(selected: boolean) {
        if (!photo || waitingAfter.current !== null) return;
        if (photo.selected !== selected) onDecide(photo.id, selected);
        advance();
    }

    function back() {
        const previous = photos[(photo ? index : photos.length) - 1];
        if (previous) onCurrentChange(previous.id);
    }

    // Lytteren byttes hver render, så den ser alltid gjeldende bilde.
    const decideRef = useRef(decide);
    const backRef = useRef(back);
    decideRef.current = decide;
    backRef.current = back;

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const key = event.key.toLowerCase();
            if (key === "arrowright" || key === "j") {
                event.preventDefault();
                decideRef.current(true);
            } else if (key === "arrowleft" || key === "k") {
                event.preventDefault();
                decideRef.current(false);
            } else if (key === "backspace") {
                event.preventDefault();
                backRef.current();
            }
        }
        // Capture-fasen: knappene fra Base UI stopper piltastene på vei opp.
        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
    }, []);

    const position = Math.min(index + 1, photos.length);

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="flex h-full flex-col gap-3 p-3 sm:max-w-3xl lg:max-w-5xl">
                <div className="flex flex-col gap-1 pr-10">
                    <DialogTitle>Gå gjennom bildene</DialogTitle>
                    <DialogDescription>
                        {photo
                            ? `Bilde ${position} av ${photos.length}${hasMore ? "+" : ""} · ${selectedCount} valgt`
                            : `${selectedCount} valgt`}
                    </DialogDescription>
                </div>

                {photo ? (
                    <>
                        <div
                            className="relative flex min-h-0 flex-1 items-center justify-center"
                            onTouchStart={(event) => {
                                touchStartX.current =
                                    event.touches[0]?.clientX ?? null;
                            }}
                            onTouchEnd={(event) => {
                                const start = touchStartX.current;
                                touchStartX.current = null;
                                const end = event.changedTouches[0]?.clientX;
                                if (start === null || end === undefined) return;
                                const distance = end - start;
                                if (Math.abs(distance) < SWIPE_PX) return;
                                decide(distance > 0);
                            }}
                        >
                            <ReviewImage photo={photo} />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-col">
                                <span className="truncate">
                                    Fra {photo.uploaderName}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    {photo.takenAt}
                                </span>
                            </div>
                            {photo.selected ? (
                                <Badge>Valgt</Badge>
                            ) : (
                                <Badge variant="outline">Ikke valgt</Badge>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                variant="outline"
                                size="lg"
                                disabled={index === 0}
                                onClick={back}
                                aria-keyshortcuts="Backspace"
                            >
                                <ChevronLeft />
                                Forrige
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={() => decide(false)}
                                aria-keyshortcuts="ArrowLeft K"
                            >
                                <X />
                                Hopp over
                            </Button>
                            <Button
                                size="lg"
                                onClick={() => decide(true)}
                                aria-keyshortcuts="ArrowRight J"
                            >
                                <Check />
                                Ta med
                            </Button>
                        </div>
                        <p className="hidden text-sm text-muted-foreground sm:block">
                            Hurtigtaster: → eller J tar med, ← eller K hopper
                            over, Backspace går tilbake.
                        </p>
                    </>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
                        <PartyPopper />
                        <p>
                            Ferdig! {selectedCount}{" "}
                            {selectedCount === 1 ? "bilde" : "bilder"} er valgt
                            til storyen.
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                disabled={photos.length === 0}
                                onClick={back}
                            >
                                <ChevronLeft />
                                Forrige
                            </Button>
                            <Button onClick={onClose}>Lukk</Button>
                        </div>
                    </div>
                )}

                <div
                    ref={stripRef}
                    className="flex shrink-0 gap-2 overflow-x-auto pb-1"
                    aria-label="Alle bildene"
                >
                    {photos.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            data-photo-id={p.id}
                            aria-current={p.id === currentId}
                            aria-label={`Bilde fra ${p.uploaderName}${p.selected ? ", valgt" : ""}`}
                            onClick={() => onCurrentChange(p.id)}
                            className="relative size-14 shrink-0 overflow-hidden rounded-md opacity-60 aria-current:opacity-100 aria-current:ring-2 aria-current:ring-primary"
                        >
                            {p.thumbSrc ? (
                                <img
                                    src={p.thumbSrc}
                                    alt=""
                                    decoding="async"
                                    className="block size-full object-cover"
                                />
                            ) : (
                                <Skeleton className="size-full" />
                            )}
                            {p.selected ? (
                                <Checkbox
                                    checked
                                    tabIndex={-1}
                                    aria-hidden
                                    className="pointer-events-none absolute top-1 left-1"
                                />
                            ) : null}
                        </button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ReviewImage({ photo }: { photo: WrappedReviewPhoto }) {
    const src = photo.largeSrc ?? photo.thumbSrc;
    if (src) {
        return (
            <img
                key={photo.id}
                src={src}
                alt={`Bilde fra ${photo.uploaderName}`}
                decoding="async"
                className="block max-h-full max-w-full object-contain"
            />
        );
    }
    if (src === null) {
        return <ImageOff />;
    }
    return <Skeleton className="size-full" />;
}
