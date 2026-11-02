import { Link } from "@tanstack/react-router";
import { IMAGE_PRESETS } from "@tihlde/ui/ui/image-preset";

import { assetImageProps } from "#/lib/assets";
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
        // Same flat surface as ListCard: a muted background appears on hover,
        // and the negative margin lets it bleed outwards so the content still
        // lines up with the page. Grids of these use no row gap and a column
        // gap of twice the bleed, so neighbouring hover surfaces meet and the
        // pointer never falls into a dead gap between two cards.
        <Link
            to="/nyheter/$slug"
            params={{ slug }}
            data-slot="news-card"
            className="-mx-2 flex h-full flex-col gap-3 rounded-xl px-2 py-3.5 transition-colors hover:bg-muted"
        >
            <div
                className={`${IMAGE_PRESETS["cover-wide"].aspectClassName} w-full overflow-hidden rounded-lg bg-muted`}
            >
                <img
                    {...assetImageProps(
                        imageUrl || DEFAULT_COVER_IMAGE,
                        "card",
                    )}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
                <h3 className="line-clamp-2 text-lg sm:text-xl">{title}</h3>
                <p className="text-sm text-muted-foreground">{publishedAt}</p>
                {excerpt ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                        {excerpt}
                    </p>
                ) : null}
            </div>
        </Link>
    );
}
