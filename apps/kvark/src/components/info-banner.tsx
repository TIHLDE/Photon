import { ArrowRightIcon, MegaphoneIcon } from "lucide-react";

import {
    Alert,
    AlertAction,
    AlertDescription,
    AlertTitle,
} from "@tihlde/ui/ui/alert";

export type InfoBannerProps = {
    title: string;
    description: string;
    url?: string | null;
    linkText?: string | null;
    openInNewTab?: boolean;
};

/** A timed announcement banner shown at the top of the front page. */
export function InfoBanner({
    title,
    description,
    url,
    linkText,
    openInNewTab = true,
}: InfoBannerProps) {
    const banner = (
        <Alert>
            <MegaphoneIcon />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
            {url ? (
                <AlertAction className="top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                    {linkText ? <span>{linkText}</span> : null}
                    <ArrowRightIcon />
                </AlertAction>
            ) : null}
        </Alert>
    );

    if (!url) return banner;

    return (
        <a
            href={url}
            target={openInNewTab ? "_blank" : undefined}
            rel={openInNewTab ? "noreferrer" : undefined}
            className="block"
        >
            {banner}
        </a>
    );
}
