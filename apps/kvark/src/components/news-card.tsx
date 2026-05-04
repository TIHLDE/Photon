import { Link } from "@tanstack/react-router";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";

export type NewsCardProps = {
    slug: string;
    title: string;
    excerpt: string;
    publishedAt: string;
    imageUrl?: string;
};

export function NewsCard({
    slug,
    title,
    excerpt,
    publishedAt,
    imageUrl,
}: NewsCardProps) {
    return (
        <Link to="/nyheter/$slug" params={{ slug }} className="block h-full">
            <Card className="h-full">
                <div className="aspect-[16/7] w-full overflow-hidden">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt=""
                            className="size-full object-cover"
                        />
                    ) : (
                        <div className="size-full bg-muted" aria-hidden />
                    )}
                </div>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{publishedAt}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="line-clamp-2">{excerpt}</p>
                </CardContent>
            </Card>
        </Link>
    );
}
