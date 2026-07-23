import { MegaphoneIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";

export type InfoBannerProps = {
    title: string;
    description: string;
    url?: string | null;
};

/** A timed announcement banner shown at the top of the front page. */
export function InfoBanner({ title, description, url }: InfoBannerProps) {
    return (
        <Alert>
            <MegaphoneIcon />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>
                <p>
                    {description}
                    {url ? (
                        <>
                            {" "}
                            <a href={url} target="_blank" rel="noreferrer">
                                Les mer
                            </a>
                        </>
                    ) : null}
                </p>
            </AlertDescription>
        </Alert>
    );
}
