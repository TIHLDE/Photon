import { type ReactElement, type ReactNode, cloneElement } from "react";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Avatar, AvatarGroup, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { ChevronRight, Images, TriangleAlert } from "lucide-react";

type WrappedMyPhotosStripProps = {
    /** Lenken til Mine bilder, som `<Link />`. */
    link: ReactElement<{ className?: string; children?: ReactNode }>;
    /** Object-URL-ene til de nyeste bildene, høyst to. */
    thumbnails: string[];
    draftCount: number;
    /** Satt den siste halvtimen før usendte bilder slettes: `HH:mm`. */
    warningUntil?: string;
};

/**
 * Snarveien fra kameraet til Mine bilder. Blir et varsel når usendte bilder
 * snart slettes.
 */
export function WrappedMyPhotosStrip({
    link,
    thumbnails,
    draftCount,
    warningUntil,
}: WrappedMyPhotosStripProps) {
    if (warningUntil) {
        // Hele varselet er lenken: det skal være så lett som mulig å komme
        // seg dit bildene sendes inn.
        return cloneElement(
            link,
            { className: "block" },
            <Alert variant="warning">
                <TriangleAlert />
                <AlertTitle>
                    {draftCount} {draftCount === 1 ? "bilde" : "bilder"} ikke
                    sendt · Send inn før {warningUntil}
                </AlertTitle>
                <AlertDescription>
                    Trykk her for å åpne Mine bilder.
                </AlertDescription>
            </Alert>,
        );
    }

    return (
        <Button
            variant="outline"
            render={link}
            className="h-15 w-full justify-between"
        >
            <span className="flex items-center gap-3">
                {thumbnails.length > 0 ? (
                    <AvatarGroup>
                        {thumbnails.map((src) => (
                            <Avatar key={src} size="lg">
                                <AvatarImage src={src} alt="" />
                            </Avatar>
                        ))}
                    </AvatarGroup>
                ) : (
                    <Images />
                )}
                Mine bilder
            </span>
            <span className="flex items-center gap-2">
                {draftCount > 0 ? (
                    <Badge variant="secondary">{draftCount} ikke sendt</Badge>
                ) : null}
                <ChevronRight />
            </span>
        </Button>
    );
}
