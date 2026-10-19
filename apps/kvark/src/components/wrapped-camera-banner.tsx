import { Link } from "@tanstack/react-router";
import {
    BottomBarBanner,
    BottomBarBannerDescription,
    BottomBarBannerTitle,
} from "@tihlde/ui/ui/bottom-bar";
import { Camera, ChevronRight } from "lucide-react";

import { cameraShortcut } from "#/lib/wrapped";

type WrappedCameraBannerProps = {
    slug: string;
    title: string;
    shotsLeft: number;
    draftCount: number;
};

/**
 * Snarveien til engangskameraet for arrangementet man er på. Ett trykk fra
 * hvor som helst på sida til kameraet.
 */
export function WrappedCameraBanner({
    slug,
    title,
    shotsLeft,
    draftCount,
}: WrappedCameraBannerProps) {
    const { action, detail } = cameraShortcut({ shotsLeft, draftCount });

    return (
        <BottomBarBanner
            render={<Link to="/arrangementer/$slug/kamera" params={{ slug }} />}
            aria-label={`${action} på ${title}, ${detail}`}
        >
            <Camera />
            <span className="flex min-w-0 flex-1 flex-col">
                <BottomBarBannerTitle>{title}</BottomBarBannerTitle>
                <BottomBarBannerDescription>
                    {action} · {detail}
                </BottomBarBannerDescription>
            </span>
            <ChevronRight />
        </BottomBarBanner>
    );
}
