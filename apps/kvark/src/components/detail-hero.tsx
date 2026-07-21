import { DEFAULT_COVER_IMAGE } from "#/lib/image";

type DetailHeroProps = {
    imageUrl?: string;
    alt?: string;
};

export function DetailHero({ imageUrl, alt = "" }: DetailHeroProps) {
    return (
        <div className="aspect-[16/7] w-full overflow-hidden rounded-xl bg-muted">
            <img
                src={imageUrl || DEFAULT_COVER_IMAGE}
                alt={alt}
                className="size-full object-cover"
            />
        </div>
    );
}
