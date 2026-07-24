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
};

/** A timed announcement banner shown at the top of the front page. */
export function InfoBanner({
    title,
    description,
    url,
    linkText,
}: InfoBannerProps) {
    const banner = (
        <Alert>
            <MegaphoneIcon />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
            {url ? (
                <AlertAction className="flex items-center gap-1.5">
                    {linkText ? <span>{linkText}</span> : null}
                    <ArrowRightIcon />
                </AlertAction>
            ) : null}
        </Alert>
    );

    if (!url) return banner;

    return (
        <a href={url} target="_blank" rel="noreferrer" className="block">
            {banner}
        </a>
    );
}
