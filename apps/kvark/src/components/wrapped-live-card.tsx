import { Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import {
    LiveCard,
    LiveCardAction,
    LiveCardChip,
    LiveCardHeader,
    LiveCardImage,
    LiveCardIndicator,
    LiveCardMedia,
    LiveCardMeta,
    LiveCardShutter,
    LiveCardTitle,
} from "@tihlde/ui/ui/live-card";
import { ArrowDown, Camera, Send, TriangleAlert } from "lucide-react";

import { assetImageProps } from "#/lib/assets";
import { formatOsloDateTime } from "#/lib/date";
import { DEFAULT_COVER_IMAGE } from "#/lib/image";
import type { CameraShortcut } from "#/lib/wrapped";

type WrappedLiveCardProps = {
    slug: string;
    title: string;
    closesAt: string;
    /** The event's banner; without one the card shows the default cover. */
    imageUrl: string | null;
    imageAlt: string | null;
    shortcut: CameraShortcut;
    /** Shots left, for the compact forms of the camera state. */
    shotsLeft: number;
    /**
     * How the camera action looks: a shutter disc on the banner's edge, the
     * full pill below it, a chip in its corner, or nothing but the card being
     * the link. Only the plain camera state gets the compact forms; every
     * other state needs words, so it gets the pill below. All four are built
     * so the team can compare them on the test site.
     * ponytail: delete the losers and this prop once one is picked.
     */
    variant: "shutter" | "below" | "chip" | "tap";
    /** Id of the section below, for «Se resten av forsiden». */
    restId: string;
};

/**
 * The first screen of the home page while the member has an open camera: the
 * event, its banner (or the default cover when it has none), when the camera
 * closes, and one tap to it — or to Mine bilder when sending in is what is
 * left. The whole card is the link.
 */
export function WrappedLiveCard({
    slug,
    title,
    closesAt,
    imageUrl,
    imageAlt,
    shortcut,
    shotsLeft,
    variant,
    restId,
}: WrappedLiveCardProps) {
    const { action, detail, target, warning } = shortcut;
    const closesAtTime = formatOsloDateTime(closesAt, {
        hour: "2-digit",
        minute: "2-digit",
    });
    const compact = target === "camera" && !warning;
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
        <div className="container mx-auto flex w-full flex-col gap-2 px-4 pt-4 pb-2 lg:py-8">
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
            >
                <LiveCardHeader>
                    <LiveCardIndicator>Pågår nå</LiveCardIndicator>
                    <LiveCardMeta>Åpent til {closesAtTime}</LiveCardMeta>
                </LiveCardHeader>
                <LiveCardTitle>{title}</LiveCardTitle>
                <LiveCardMedia
                    edge={
                        compact && variant === "shutter" ? (
                            <LiveCardShutter>
                                <Camera />
                                {shotsLeft}
                            </LiveCardShutter>
                        ) : undefined
                    }
                    overlay={
                        compact && variant === "chip" ? (
                            <LiveCardChip>
                                <Camera />
                                Ta bilde · {shotsLeft}
                            </LiveCardChip>
                        ) : compact && variant === "tap" ? (
                            <LiveCardChip variant="card">
                                <Camera />
                                {shotsLeft} igjen
                            </LiveCardChip>
                        ) : undefined
                    }
                    overlayPosition={
                        variant === "tap" ? "top-end" : "bottom-end"
                    }
                >
                    {/* Above the fold and the reason the card exists,
                     * so loaded eagerly at high priority like DetailHero. */}
                    <LiveCardImage
                        {...assetImageProps(
                            imageUrl || DEFAULT_COVER_IMAGE,
                            "hero",
                        )}
                        alt={imageUrl ? (imageAlt ?? "") : ""}
                        fetchPriority="high"
                        decoding="async"
                    />
                </LiveCardMedia>
                {compact && variant !== "below" ? null : actionPill}
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
