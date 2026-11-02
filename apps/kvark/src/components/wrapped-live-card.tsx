import { Link } from "@tanstack/react-router";
import { cn } from "@tihlde/ui/lib/utils";
import { Button } from "@tihlde/ui/ui/button";
import { DisposableCamera } from "@tihlde/ui/ui/disposable-camera";
import {
    LiveCard,
    LiveCardAction,
    LiveCardHeader,
    LiveCardImage,
    LiveCardIndicator,
    LiveCardMedia,
    LiveCardMeta,
    LiveCardTitle,
} from "@tihlde/ui/ui/live-card";
import { ArrowDown, Camera, Send, TriangleAlert } from "lucide-react";

import { assetImageProps } from "#/lib/assets";
import { formatOsloDateTime } from "#/lib/date";
import type { CameraShortcut } from "#/lib/wrapped";

type WrappedLiveCardProps = {
    slug: string;
    title: string;
    closesAt: string;
    shotsLeft: number;
    /** The event's banner; without one the card draws the camera instead. */
    imageUrl: string | null;
    imageAlt: string | null;
    shortcut: CameraShortcut;
    /**
     * Where the action sits: over the banner's foot, or below it. Both are
     * built so the team can compare them on the test site.
     * ponytail: drop the losing branch and this prop once one is picked.
     */
    actionPlacement: "overlay" | "below";
    /** Id of the section below, for «Se resten av forsiden». */
    restId: string;
};

/**
 * The first screen of the home page while the member has an open camera: the
 * event, its banner (or the camera drawing when it has none), when the camera
 * closes, and one tap to it — or to Mine bilder when sending in is what is
 * left. The whole card is the link.
 */
export function WrappedLiveCard({
    slug,
    title,
    closesAt,
    shotsLeft,
    imageUrl,
    imageAlt,
    shortcut,
    actionPlacement,
    restId,
}: WrappedLiveCardProps) {
    const { action, detail, target, warning } = shortcut;
    const closesAtTime = formatOsloDateTime(closesAt, {
        hour: "2-digit",
        minute: "2-digit",
    });
    const overlay = actionPlacement === "overlay";
    const actionPill = (
        <LiveCardAction variant={warning ? "warning" : "default"}>
            {warning ? (
                <TriangleAlert />
            ) : target === "mine" ? (
                <Send />
            ) : (
                <Camera />
            )}
            {action} · {detail}
        </LiveCardAction>
    );

    return (
        // Fills what the first screen offers on a phone: the viewport minus
        // the 3.5rem header and the 4rem bottom bar with its safe-area inset.
        // The camera banner is hidden on the home page while this shows, so
        // the bottom bar is at its short height.
        <div className="container mx-auto flex min-h-[calc(100dvh_-_3.5rem_-_4rem_-_env(safe-area-inset-bottom))] w-full flex-col gap-2 px-4 pt-4 pb-2 lg:min-h-0 lg:py-8">
            <LiveCard
                render={
                    target === "mine" ? (
                        <Link
                            to="/arrangementer/$slug/kamera/mine"
                            params={{ slug }}
                        />
                    ) : (
                        <Link
                            to="/arrangementer/$slug/kamera"
                            params={{ slug }}
                        />
                    )
                }
                aria-label={`${action} på ${title}, ${detail}`}
                className="flex-1 lg:min-h-[32rem]"
            >
                <LiveCardHeader>
                    <LiveCardIndicator>Pågår nå</LiveCardIndicator>
                    <LiveCardMeta>Åpent til {closesAtTime}</LiveCardMeta>
                </LiveCardHeader>
                <LiveCardTitle>{title}</LiveCardTitle>
                <LiveCardMedia
                    overlay={overlay ? actionPill : undefined}
                    className="flex-1"
                >
                    {imageUrl ? (
                        // Above the fold and the reason the card exists,
                        // so loaded eagerly at high priority like DetailHero.
                        <LiveCardImage
                            {...assetImageProps(imageUrl, "hero")}
                            alt={imageAlt ?? ""}
                            fetchPriority="high"
                            decoding="async"
                        />
                    ) : (
                        // No banner: the camera stands in. `pb-32` keeps it
                        // clear of an action laid over the frame's foot.
                        <div
                            className={cn(
                                "absolute inset-0 flex items-center justify-center p-6",
                                overlay && "pb-32",
                            )}
                        >
                            <DisposableCamera
                                shotsLeft={shotsLeft}
                                className="max-h-full max-w-sm"
                            />
                        </div>
                    )}
                </LiveCardMedia>
                {overlay ? null : actionPill}
            </LiveCard>
            <div className="flex justify-center">
                <Button
                    variant="ghost"
                    size="sm"
                    render={<a href={`#${restId}`} />}
                >
                    <ArrowDown />
                    Se resten av forsiden
                </Button>
            </div>
        </div>
    );
}
