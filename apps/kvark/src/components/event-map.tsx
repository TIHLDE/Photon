export type EventMapProps = {
    src: string;
    title?: string;
};

export function EventMap({ src, title = "Kart" }: EventMapProps) {
    return (
        <div className="aspect-video w-full overflow-hidden rounded-xl border">
            <iframe
                src={src}
                title={title}
                loading="lazy"
                className="size-full"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
            />
        </div>
    );
}
