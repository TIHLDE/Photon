import { Button } from "@tihlde/ui/ui/button";
import { Dialog, DialogContent } from "@tihlde/ui/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { assetImageUrl } from "#/lib/assets";

export type LightboxPicture = {
    id: string;
    imageUrl: string;
    imageAlt?: string | null;
    title?: string | null;
    description?: string | null;
};

type GalleryLightboxProps = {
    pictures: LightboxPicture[];
    /** Index into `pictures`, or null when the lightbox is closed. */
    openIndex: number | null;
    onOpenChange: (index: number | null) => void;
};

/**
 * Full-size viewer for an album. Knows the whole picture list, so it can step
 * between images with the arrow keys, the on-screen arrows, or a swipe.
 */
export function GalleryLightbox({
    pictures,
    openIndex,
    onOpenChange,
}: GalleryLightboxProps) {
    const index = openIndex ?? -1;
    const picture = pictures[index] ?? null;
    const touchStartX = useRef<number | null>(null);

    const go = useCallback(
        (delta: number) => {
            if (openIndex === null) return;
            const next = openIndex + delta;
            if (next < 0 || next >= pictures.length) return;
            onOpenChange(next);
        },
        [openIndex, pictures.length, onOpenChange],
    );

    useEffect(() => {
        if (openIndex === null) return;

        function onKeyDown(event: KeyboardEvent) {
            // Skriving skal alltid vinne over bla-snarveien.
            const target = event.target as HTMLElement | null;
            if (
                target?.isContentEditable ||
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement
            ) {
                return;
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                go(-1);
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                go(1);
            }
        }

        // Capture-fasen, ikke bobling: knappene i lightboxen kommer fra Base UI,
        // som stopper propagering av piltaster. Har du nettopp klikket på en av
        // pilene (eller lukkeknappen) står fokus der, og en vanlig
        // window-lytter ville aldri sett tasten.
        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
    }, [openIndex, go]);

    if (!picture) return null;

    const alt = picture.imageAlt ?? picture.title ?? "";

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onOpenChange(null);
            }}
        >
            <DialogContent className="flex max-w-[95vw] flex-col gap-2 p-2 sm:max-w-3xl lg:max-w-5xl">
                <div
                    className="relative"
                    onTouchStart={(event) => {
                        touchStartX.current = event.touches[0]?.clientX ?? null;
                    }}
                    onTouchEnd={(event) => {
                        const start = touchStartX.current;
                        touchStartX.current = null;
                        const end = event.changedTouches[0]?.clientX;
                        if (start === null || end === undefined) return;
                        // Under 50 px er like gjerne en upresis tapp som en
                        // bevisst sveip.
                        const distance = end - start;
                        if (Math.abs(distance) < 50) return;
                        go(distance < 0 ? 1 : -1);
                    }}
                >
                    {/*
                     * The lightbox caps at 85vh inside a max-w-5xl dialog, so
                     * even on a large screen 1920 px is more than it can show
                     * — no reason to pull the multi-megabyte original.
                     */}
                    <img
                        src={assetImageUrl(picture.imageUrl, 1920)}
                        alt={alt}
                        decoding="async"
                        className="block h-auto max-h-[85vh] w-full object-contain"
                    />

                    {index > 0 ? (
                        <Button
                            variant="outline"
                            size="icon"
                            aria-label="Forrige bilde"
                            className="absolute top-1/2 left-2 -translate-y-1/2"
                            onClick={() => go(-1)}
                        >
                            <ChevronLeft />
                        </Button>
                    ) : null}
                    {index < pictures.length - 1 ? (
                        <Button
                            variant="outline"
                            size="icon"
                            aria-label="Neste bilde"
                            className="absolute top-1/2 right-2 -translate-y-1/2"
                            onClick={() => go(1)}
                        >
                            <ChevronRight />
                        </Button>
                    ) : null}
                </div>

                <div className="flex flex-col gap-1 px-2 pb-2">
                    {picture.title ? <p>{picture.title}</p> : null}
                    {picture.description ? (
                        <p className="text-muted-foreground">
                            {picture.description}
                        </p>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                        {index + 1} / {pictures.length}
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
