import type { ReactElement, Ref } from "react";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    CameraControlButton,
    CameraScreen,
    CameraTitle,
} from "@tihlde/ui/ui/camera-viewfinder";
import {
    type CarouselApi,
    Carousel,
    CarouselContent,
    CarouselDots,
    CarouselItem,
} from "@tihlde/ui/ui/carousel";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { ChevronLeft, ChevronRight, ImageOff, Trash2, X } from "lucide-react";

export type WrappedReviewPhoto = {
    id: string;
    /** Object-URL-en, `undefined` mens den hentes, `null` hvis den feilet. */
    src: string | null | undefined;
    fromCameraRoll: boolean;
    submitted: boolean;
};

type WrappedPhotoReviewProps = {
    photos: WrappedReviewPhoto[];
    /** Bildet som vises, fra 0. */
    index: number;
    /** Hvor karusellen starter når den lages. */
    startIndex: number;
    setApi: (api: CarouselApi) => void;
    onPrevious: () => void;
    onNext: () => void;
    onDelete: () => void;
    /** Tilbake til Mine bilder, som `<Link />`. */
    closeLink: ReactElement;
    deleteRef: Ref<HTMLButtonElement>;
    /** Typet som knapp, men er en lenke: bare `focus()` brukes. */
    keepRef: Ref<HTMLButtonElement>;
};

/**
 * Egne bilder i full skjerm: sveip eller trykk deg gjennom dem, og slett de
 * du ikke vil sende inn. Ingen bekreftelse — slettingen kan angres.
 */
export function WrappedPhotoReview({
    photos,
    index,
    startIndex,
    setApi,
    onPrevious,
    onNext,
    onDelete,
    closeLink,
    deleteRef,
    keepRef,
}: WrappedPhotoReviewProps) {
    const total = photos.length;
    const current = photos[index];

    return (
        <CameraScreen>
            <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-3 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] items-center gap-2">
                    <CameraControlButton
                        render={closeLink}
                        aria-label="Lukk og gå til Mine bilder"
                    >
                        <X />
                    </CameraControlButton>
                    <CameraTitle aria-live="polite">
                        {index + 1} av {total}
                    </CameraTitle>
                </div>

                <Carousel
                    setApi={setApi}
                    opts={{ startIndex }}
                    aria-label="Mine bilder"
                    className="relative"
                >
                    <CarouselContent>
                        {photos.map((photo, i) => (
                            <CarouselItem
                                key={photo.id}
                                className="relative flex h-[calc(100dvh-14rem)] items-center justify-center"
                            >
                                {photo.src ? (
                                    <img
                                        src={photo.src}
                                        alt={`Bilde ${i + 1} av ${total}`}
                                        className="max-h-full max-w-full object-contain"
                                    />
                                ) : photo.src === null ? (
                                    <ImageOff
                                        role="img"
                                        aria-label={`Bilde ${i + 1} av ${total} kunne ikke vises`}
                                    />
                                ) : (
                                    <Spinner className="size-8" />
                                )}
                                <span className="absolute top-2 left-6 flex gap-1">
                                    {photo.submitted ? (
                                        <Badge>Sendt</Badge>
                                    ) : null}
                                    {photo.fromCameraRoll ? (
                                        <Badge variant="secondary">
                                            Kamerarull
                                        </Badge>
                                    ) : null}
                                </span>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    {/* Store knapper ved siden av sveipingen, for den som
                     * ikke får til å sveipe rett. */}
                    <CameraControlButton
                        aria-label="Forrige bilde"
                        disabled={index === 0}
                        onClick={onPrevious}
                        className="absolute top-1/2 left-1 size-14 -translate-y-1/2"
                    >
                        <ChevronLeft />
                    </CameraControlButton>
                    <CameraControlButton
                        aria-label="Neste bilde"
                        disabled={index >= total - 1}
                        onClick={onNext}
                        className="absolute top-1/2 right-1 size-14 -translate-y-1/2"
                    >
                        <ChevronRight />
                    </CameraControlButton>
                    <CarouselDots className="pt-3" />
                </Carousel>

                <div className="mt-auto grid grid-cols-2 gap-3">
                    {current && !current.submitted ? (
                        <Button
                            ref={deleteRef}
                            variant="destructive"
                            size="lg"
                            className="min-h-16"
                            onClick={onDelete}
                        >
                            <Trash2 />
                            Slett
                        </Button>
                    ) : null}
                    <Button
                        ref={keepRef}
                        variant="secondary"
                        size="lg"
                        className={
                            current && !current.submitted
                                ? "min-h-16"
                                : "col-span-2 min-h-16"
                        }
                        render={closeLink}
                    >
                        Behold
                    </Button>
                </div>
            </div>
        </CameraScreen>
    );
}
