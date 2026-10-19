import { Link } from "@tanstack/react-router";
import {
    BottomBarBanner,
    BottomBarBannerDescription,
    BottomBarBannerTitle,
} from "@tihlde/ui/ui/bottom-bar";
import { Camera, ChevronRight, Send, TriangleAlert } from "lucide-react";

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
    const { action, detail, target, warning } = shortcut;

    return (
        <BottomBarBanner
            variant={warning ? "warning" : "default"}
            render={
                target === "mine" ? (
                    <Link
                        to="/arrangementer/$slug/kamera/mine"
                        params={{ slug }}
                    />
                ) : (
                    <Link to="/arrangementer/$slug/kamera" params={{ slug }} />
                )
            }
            aria-label={`${action} på ${title}, ${detail}`}
        >
            {warning ? (
                <TriangleAlert />
            ) : target === "mine" ? (
                <Send />
            ) : (
                <Camera />
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
