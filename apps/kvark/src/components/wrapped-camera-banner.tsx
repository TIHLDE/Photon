import { Link } from "@tanstack/react-router";
import {
    BottomBarBanner,
    BottomBarBannerDescription,
    BottomBarBannerTitle,
} from "@tihlde/ui/ui/bottom-bar";
import {
    Camera,
    ChevronRight,
    Images,
    Send,
    TriangleAlert,
} from "lucide-react";

import type { CameraShortcut } from "#/lib/wrapped";

type WrappedCameraBannerProps = {
    slug: string;
    title: string;
    shortcut: CameraShortcut;
};

/**
 * Snarveien til engangskameraet for arrangementet man er på. Ett trykk fra
 * hvor som helst på sida til kameraet — eller til Mine bilder når det er
 * innsending som gjenstår.
 */
export function WrappedCameraBanner({
    slug,
    title,
    shortcut,
}: WrappedCameraBannerProps) {
    const { action, detail, kind, warning } = shortcut;

    return (
        <BottomBarBanner
            variant={warning ? "warning" : "default"}
            render={
                kind === "shoot" ? (
                    <Link to="/arrangementer/$slug/kamera" params={{ slug }} />
                ) : (
                    <Link
                        to="/arrangementer/$slug/kamera/mine"
                        params={{ slug }}
                    />
                )
            }
            aria-label={`${action} på ${title}, ${detail}`}
        >
            {warning ? (
                <TriangleAlert />
            ) : kind === "shoot" ? (
                <Camera />
            ) : kind === "submit" ? (
                <Send />
            ) : (
                <Images />
            )}
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
