import { assetImageProps } from "#/lib/assets";

export type GalleryPictureProps = {
    imageUrl: string;
    imageAlt?: string | null;
    title?: string | null;
    onOpen: () => void;
};

/**
 * One thumbnail in an album. Opening full size is the album's job — each
 * picture used to own an isolated `Dialog`, which is why there was no way to
 * step to the next image once one was open.
 */
export function GalleryPicture({
    imageUrl,
    imageAlt,
    title,
    onOpen,
}: GalleryPictureProps) {
    const alt = imageAlt ?? title ?? "";

    return (
        <button
            type="button"
            onClick={onOpen}
            className="mb-4 block w-full overflow-hidden"
        >
            {/*
             * A thumbnail here is one column of a masonry grid, never more
             * than ~400 px wide, while the originals are camera-sized JPEGs.
             * Pointing straight at those made an album cost hundreds of MB.
             */}
            <img
                {...assetImageProps(imageUrl, "galleryThumb")}
                alt={alt}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full object-cover"
            />
        </button>
    );
}
