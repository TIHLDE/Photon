type DetailHeroProps = {
    imageUrl?: string;
    alt?: string;
};

export function DetailHero({ imageUrl, alt = "" }: DetailHeroProps) {
    return (
        <div className="aspect-[16/7] w-full overflow-hidden rounded-xl bg-muted">
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={alt}
                    className="size-full object-cover"
                />
            ) : null}
        </div>
    );
}
