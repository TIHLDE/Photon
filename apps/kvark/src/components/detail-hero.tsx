import { IMAGE_PRESETS } from "@tihlde/ui/ui/image-preset";

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
            <img
                src={imageUrl || DEFAULT_COVER_IMAGE}
                alt={alt}
                className="size-full object-cover"
            />
        </div>
    );
}
