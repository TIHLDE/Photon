import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";

export type NewsCardProps = {
    title: string;
    excerpt: string;
    publishedAt: string;
    imageUrl?: string;
};

export function NewsCard({
    title,
    excerpt,
    publishedAt,
    imageUrl,
}: NewsCardProps) {
    return (
        <Card>
            <div className="aspect-video w-full overflow-hidden">
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
    );
}
