import type { ReactElement, ReactNode } from "react";
import { Avatar, AvatarGroup, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { ChevronRight, Images } from "lucide-react";

type WrappedMyPhotosStripProps = {
    /** Lenken til Mine bilder, som `<Link />`. */
    link: ReactElement<{ className?: string; children?: ReactNode }>;
    /** Object-URL-ene til de nyeste bildene, høyst to. */
    thumbnails: string[];
    draftCount: number;
};

/** Snarveien fra kameraet til Mine bilder. */
export function WrappedMyPhotosStrip({
    link,
    thumbnails,
    draftCount,
}: WrappedMyPhotosStripProps) {
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
                    <Badge variant="secondary">
                        {draftCount} {draftCount === 1 ? "bilde" : "bilder"}
                    </Badge>
                ) : null}
                <ChevronRight />
            </span>
        </Button>
    );
}
