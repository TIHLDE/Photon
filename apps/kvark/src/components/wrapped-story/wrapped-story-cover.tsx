import {
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
    /** Til første bilde, fra «Sveip opp»-knappen. */
    onNext: () => void;
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
}: WrappedStoryCoverProps) {
    return (
        <StorySlide aria-label={`Wrapped fra ${title}`} data-story-index={0}>
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
                <StorySwipeHint onClick={onNext}>Sveip opp</StorySwipeHint>
            ) : null}
        </StorySlide>
    );
}
