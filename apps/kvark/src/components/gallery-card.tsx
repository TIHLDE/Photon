import { Link } from "@tanstack/react-router";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";

export type GalleryCardProps = {
    slug: string;
    title: string;
    description?: string | null;
    /** Cover image. Albums with no pictures yet have none. */
    imageUrl?: string | null;
    pictureCount?: number;
};

export function GalleryCard({
    slug,
    title,
    description,
    imageUrl,
    pictureCount,
}: GalleryCardProps) {
    return (
        <Card
            className="h-full"
            render={<Link to="/galleri/$slug" params={{ slug }} />}
        >
            {/*
             * Direct child, not wrapped: Card drops its top padding and rounds
             * the top corners only for an `img:first-child`, so a ratio wrapper
             * leaves a strip of card above the image. The ratio goes here.
             */}
            {imageUrl && (
                <img
                    src={imageUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                />
            )}
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description && (
                    <CardDescription className="line-clamp-2">
                        {description}
                    </CardDescription>
                )}
                {pictureCount !== undefined && (
                    <CardDescription>
                        {pictureCount === 1
                            ? "1 bilde"
                            : `${pictureCount} bilder`}
                    </CardDescription>
                )}
            </CardHeader>
        </Card>
    );
}
