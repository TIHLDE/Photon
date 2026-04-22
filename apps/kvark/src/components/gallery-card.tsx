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
    description?: string;
    imageUrl: string;
};

export function GalleryCard({
    slug,
    title,
    description,
    imageUrl,
}: GalleryCardProps) {
    return (
        <Link to="/galleri/$slug" params={{ slug }} className="block h-full">
            <Card className="h-full">
                <div className="aspect-video w-full overflow-hidden">
                    <img
                        src={imageUrl}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                    />
                </div>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    {description ? (
                        <CardDescription className="line-clamp-2">
                            {description}
                        </CardDescription>
                    ) : null}
                </CardHeader>
            </Card>
        </Link>
    );
}
