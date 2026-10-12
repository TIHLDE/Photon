import { Link } from "@tanstack/react-router";
import {
    BottomBarBanner,
    BottomBarBannerDescription,
    BottomBarBannerTitle,
} from "@tihlde/ui/ui/bottom-bar";
import { Camera, ChevronRight } from "lucide-react";

type WrappedCameraBannerProps = {
    slug: string;
    title: string;
    shotsLeft: number;
};

/**
 * Snarveien til engangskameraet for arrangementet man er på. Ett trykk fra
 * hvor som helst på sida til kameraet.
 */
export function WrappedCameraBanner({
    slug,
    title,
    shotsLeft,
}: WrappedCameraBannerProps) {
    const left = `${shotsLeft} ${shotsLeft === 1 ? "bilde" : "bilder"} igjen`;

    return (
        <BottomBarBanner
            render={<Link to="/arrangementer/$slug/kamera" params={{ slug }} />}
            aria-label={`Ta bilde på ${title}, ${left}`}
        >
            <Camera />
            <span className="flex min-w-0 flex-1 flex-col">
                <BottomBarBannerTitle>{title}</BottomBarBannerTitle>
                <BottomBarBannerDescription>
                    Ta bilde · {left}
                </BottomBarBannerDescription>
            </span>
            <ChevronRight />
        </BottomBarBanner>
    );
}
