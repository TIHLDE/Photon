import { IMAGE_PRESETS } from "@tihlde/ui/ui/image-preset";

import { assetImageProps } from "#/lib/assets";
import { DEFAULT_COVER_IMAGE } from "#/lib/image";

type DetailHeroProps = {
    imageUrl?: string;
    alt?: string;
};

export function DetailHero({ imageUrl, alt = "" }: DetailHeroProps) {
    return (
        <div
            className={`${IMAGE_PRESETS["cover-wide"].aspectClassName} w-full overflow-hidden rounded-xl bg-muted`}
        >
            {/*
             * The hero is the largest element above the fold on every detail
             * page, so it is what LCP measures: loaded eagerly and at high
             * priority, unlike every other image on the site.
             */}
            <img
                {...assetImageProps(imageUrl || DEFAULT_COVER_IMAGE, "hero")}
                alt={alt}
                fetchPriority="high"
                decoding="async"
                className="size-full object-cover"
            />
        </div>
    );
}
