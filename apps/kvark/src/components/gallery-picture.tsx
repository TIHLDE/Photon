import { Dialog, DialogContent, DialogTrigger } from "@tihlde/ui/ui/dialog";

export type GalleryPictureProps = {
    imageUrl: string;
    imageAlt?: string | null;
    title?: string | null;
    description?: string | null;
};

/** One picture in an album, opening full-size in a dialog when clicked. */
export function GalleryPicture({
    imageUrl,
    imageAlt,
    title,
    description,
}: GalleryPictureProps) {
    const alt = imageAlt ?? title ?? "";

    return (
        <Dialog>
            <DialogTrigger className="mb-4 block w-full overflow-hidden">
                <img
                    src={imageUrl}
                    alt={alt}
                    loading="lazy"
                    className="block h-auto w-full object-cover"
                />
            </DialogTrigger>
            <DialogContent className="flex max-w-[95vw] flex-col gap-2 p-2 sm:max-w-3xl lg:max-w-5xl">
                <img
                    src={imageUrl}
                    alt={alt}
                    className="block h-auto max-h-[85vh] w-full object-contain"
                />
                {(title || description) && (
                    <div className="flex flex-col gap-1 px-2 pb-2">
                        {title && <p>{title}</p>}
                        {description && (
                            <p className="text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
