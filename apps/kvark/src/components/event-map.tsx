export type EventMapProps = {
    src: string;
    title?: string;
};

// Allowlist of trusted embed hosts. Anything else is dropped to avoid letting
// arbitrary user-supplied URLs render in an iframe under our origin.
// TODO(SDK): re-evaluate when mapEmbedUrl is wired through the backend; the
// API should ideally validate this on write so the frontend can trust it.
const ALLOWED_HOSTS = new Set([
    "use.mazemap.com",
    "www.google.com",
    "maps.google.com",
]);

function isAllowedSrc(src: string): boolean {
    try {
        const url = new URL(src);
        return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname);
    } catch {
        return false;
    }
}

export function EventMap({ src, title = "Kart" }: EventMapProps) {
    if (!isAllowedSrc(src)) return null;

    return (
        <div className="aspect-video w-full overflow-hidden rounded-xl border">
            <iframe
                src={src}
                title={title}
                loading="lazy"
                className="size-full"
                referrerPolicy="no-referrer-when-downgrade"
                sandbox="allow-scripts allow-same-origin allow-popups"
                allowFullScreen
            />
        </div>
    );
}
