import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Spinner } from "@tihlde/ui/ui/spinner";
import {
    StoryCard,
    StoryCaption,
    StoryImage,
    StorySlide,
} from "@tihlde/ui/ui/story-viewer";
import { ImageOff } from "lucide-react";
import type { ReactNode } from "react";

import { useDoubleTap } from "#/hooks/use-double-tap";
import { formatInOslo } from "#/lib/date";

export type WrappedStoryPhotoData = {
    id: string;
    /** Mangler mens bildet hentes, `null` hvis hentingen feilet. */
    src: string | null | undefined;
    photographerName: string;
    photographerImage: string | null;
    takenAt: string;
};

type WrappedStoryPhotoProps = WrappedStoryPhotoData & {
    /** Plassen i storyen, med forsiden som 0. */
    index: number;
    /** Knappene til høyre, f.eks. lik og kommentar. */
    actions?: ReactNode;
    /** Det som legges over bildet, f.eks. hjertet ved dobbelttrykk. */
    overlay?: ReactNode;
    /** `slide` fyller skjermen i storyen som rulles, `card` ligger i kortbunken. */
    variant?: "slide" | "card";
    /** Dobbelttrykk på bildet, med finger eller mus. */
    onDoubleTap?: () => void;
};

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

/** Ett bilde i storyen, med hvem som tok det nederst. */
export function WrappedStoryPhoto({
    id,
    src,
    photographerName,
    photographerImage,
    takenAt,
    index,
    actions,
    overlay,
    variant = "slide",
    onDoubleTap,
}: WrappedStoryPhotoProps) {
    const doubleTap = useDoubleTap(() => onDoubleTap?.());
    const Frame = variant === "card" ? StoryCard : StorySlide;

    return (
        <Frame
            aria-label={`Bilde tatt av ${photographerName}`}
            data-story-index={index}
            data-photo-id={id}
            {...(onDoubleTap ? doubleTap : {})}
        >
            {src ? (
                <StoryImage
                    src={src}
                    alt={`Bilde tatt av ${photographerName}`}
                />
            ) : src === null ? (
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <ImageOff aria-hidden />
                    Kunne ikke laste bildet
                </div>
            ) : (
                <Spinner />
            )}
            {overlay}
            <StoryCaption>
                <Avatar>
                    {photographerImage ? (
                        <AvatarImage src={photographerImage} alt="" />
                    ) : null}
                    <AvatarFallback>
                        {initials(photographerName)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">
                        {photographerName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {formatInOslo(takenAt, "HH:mm")}
                    </span>
                </div>
            </StoryCaption>
            {actions}
        </Frame>
    );
}
