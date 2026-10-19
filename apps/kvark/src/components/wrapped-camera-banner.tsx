import { Link } from "@tanstack/react-router";
import {
    BottomBarBanner,
    BottomBarBannerDescription,
    BottomBarBannerTitle,
} from "@tihlde/ui/ui/bottom-bar";
import { Camera, ChevronRight, TriangleAlert } from "lucide-react";

type WrappedCameraBannerProps = {
    slug: string;
    title: string;
    shotsLeft: number;
    /**
     * Satt den siste halvtimen før usendte bilder slettes. Da peker banneret
     * til Mine bilder i stedet for kameraet.
     */
    warning?: { draftCount: number; until: string };
};

/**
 * Snarveien til engangskameraet for arrangementet man er på. Ett trykk fra
 * hvor som helst på sida til kameraet.
 */
export function WrappedCameraBanner({
    slug,
    title,
    shotsLeft,
    warning,
}: WrappedCameraBannerProps) {
    if (warning) {
        const { draftCount, until } = warning;
        const text = `${draftCount} ${draftCount === 1 ? "bilde" : "bilder"} ikke sendt · Send inn før ${until}`;
        return (
            <BottomBarBanner
                variant="warning"
                render={
                    <Link
                        to="/arrangementer/$slug/kamera/mine"
                        params={{ slug }}
                    />
                }
                aria-label={`${title}: ${text}`}
            >
                <TriangleAlert />
                <span className="flex min-w-0 flex-1 flex-col">
                    <BottomBarBannerTitle>{title}</BottomBarBannerTitle>
                    <BottomBarBannerDescription>
                        {text}
                    </BottomBarBannerDescription>
                </span>
                <ChevronRight />
            </BottomBarBanner>
        );
    }

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
