import { Link } from "@tanstack/react-router";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";

import { DEFAULT_COVER_IMAGE } from "#/lib/image";

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
        <Card
            className="h-full"
            render={<Link to="/nyheter/$slug" params={{ slug }} />}
        >
            {/*
             * Direct child, not wrapped: Card drops its top padding and rounds
             * the top corners only for an `img:first-child`, so a ratio wrapper
             * leaves a strip of card above the image. The ratio goes here.
             */}
            <img
                src={imageUrl || DEFAULT_COVER_IMAGE}
                alt=""
                className="aspect-[16/7] w-full object-cover"
            />
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
