import {
    StoryCard,
    StoryCoverContent,
    StoryCoverEyebrow,
    StoryCoverImage,
    StoryCoverMeta,
    StoryCoverTitle,
    StorySlide,
    StorySwipeHint,
} from "@tihlde/ui/ui/story-viewer";

import { formatOsloDate } from "#/lib/date";

type WrappedStoryCoverProps = {
    title: string;
    start: string;
    imageUrl: string | null;
    photoCount: number;
    /** Til første bilde, fra «Sveip»-knappen. */
    onNext: () => void;
    /** `slide` fyller skjermen i storyen som rulles, `card` ligger i kortbunken. */
    variant?: "slide" | "card";
};

/**
 * Første side i storyen: hvilket arrangement bildene er fra. Uten bilde
 * står tittelen alene på svart.
 */
export function WrappedStoryCover({
    title,
    start,
    imageUrl,
    photoCount,
    onNext,
    variant = "slide",
}: WrappedStoryCoverProps) {
    const Frame = variant === "card" ? StoryCard : StorySlide;
    return (
        <Frame aria-label={`Wrapped fra ${title}`} data-story-index={0}>
            {imageUrl ? <StoryCoverImage src={imageUrl} /> : null}
            <StoryCoverContent>
                <StoryCoverEyebrow>Wrapped</StoryCoverEyebrow>
                <StoryCoverTitle>{title}</StoryCoverTitle>
                <StoryCoverMeta>
                    {formatOsloDate(start, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                    })}
                    {" · "}
                    {photoCount === 1 ? "1 bilde" : `${photoCount} bilder`}
                </StoryCoverMeta>
            </StoryCoverContent>
            {photoCount > 0 ? (
                <StorySwipeHint
                    onClick={onNext}
                    direction={variant === "card" ? "right" : "up"}
                >
                    {variant === "card" ? "Sveip til høyre" : "Sveip opp"}
                </StorySwipeHint>
            ) : null}
        </Frame>
    );
}
