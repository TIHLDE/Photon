import { Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { DisposableCamera } from "@tihlde/ui/ui/disposable-camera";
import {
    LiveCard,
    LiveCardAction,
    LiveCardHeader,
    LiveCardIndicator,
    LiveCardMeta,
    LiveCardTitle,
} from "@tihlde/ui/ui/live-card";
import { ArrowDown, Camera, Send } from "lucide-react";

import { formatOsloDateTime } from "#/lib/date";
import { cameraShortcut } from "#/lib/wrapped";

type WrappedLiveCardProps = {
    slug: string;
    title: string;
    closesAt: string;
    shotsLeft: number;
    draftCount: number;
    /** Id of the section below, for «Se resten av forsiden». */
    restId: string;
};

/**
 * The first screen of the home page while the member has an open camera: the
 * event, when the camera closes, and one tap to it. The whole card is the link.
 */
export function WrappedLiveCard({
    slug,
    title,
    closesAt,
    shotsLeft,
    draftCount,
    restId,
}: WrappedLiveCardProps) {
    const { action, detail } = cameraShortcut({ shotsLeft, draftCount });
    const closesAtTime = formatOsloDateTime(closesAt, {
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        // Fills what the first screen offers on a phone: the viewport minus
        // the 3.5rem header and the 4rem bottom bar with its safe-area inset.
        // The camera banner is hidden on the home page while this shows, so
        // the bottom bar is at its short height.
        <div className="container mx-auto flex min-h-[calc(100dvh_-_3.5rem_-_4rem_-_env(safe-area-inset-bottom))] w-full flex-col gap-2 px-4 pt-4 pb-2 lg:min-h-0 lg:py-8">
            <LiveCard
                render={
                    <Link to="/arrangementer/$slug/kamera" params={{ slug }} />
                }
                aria-label={`${action} på ${title}, ${detail}`}
                className="flex-1 lg:min-h-[32rem]"
            >
                <LiveCardHeader>
                    <LiveCardIndicator>Pågår nå</LiveCardIndicator>
                    <LiveCardMeta>Åpent til {closesAtTime}</LiveCardMeta>
                </LiveCardHeader>
                <LiveCardTitle>{title}</LiveCardTitle>
                <div className="flex flex-1 items-center justify-center py-2">
                    <DisposableCamera
                        shotsLeft={shotsLeft}
                        className="max-h-[40dvh] max-w-sm"
                    />
                </div>
                <LiveCardAction>
                    {shotsLeft === 0 && draftCount > 0 ? <Send /> : <Camera />}
                    {action} · {detail}
                </LiveCardAction>
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
