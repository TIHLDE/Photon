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
            <img
                src={imageUrl}
                alt={alt}
                loading="lazy"
                className="block h-auto w-full object-cover"
            />
        </button>
    );
}
