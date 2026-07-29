type MapsLinkTarget = {
    /** Adressen slik den vises, brukes som navn på punktet i kartet. */
    label: string;
    lat?: number | null;
    lng?: number | null;
};

export type MapsUrls = {
    google: string;
    apple: string;
};

/**
 * Lager kartlenker for et sted med kjente koordinater — én per karttjeneste,
 * slik at brukeren selv velger hvor stedet skal åpnes.
 *
 * Begge URL-ene er "universal links": på mobil åpner de appen om den er
 * installert, ellers karttjenesten i nettleseren.
 *
 * Returnerer null for steder uten koordinater (fritekst som "Digitalt" eller
 * "R1"), slik at de vises som vanlig tekst i stedet for en lenke som peker
 * feil sted.
 */
export function buildMapsUrls({
    label,
    lat,
    lng,
}: MapsLinkTarget): MapsUrls | null {
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const coordinates = `${lat},${lng}`;

    const google = new URLSearchParams({ api: "1", query: coordinates });
    // Apple Maps bruker `ll` for punktet og `q` som etikett på nålen.
    const apple = new URLSearchParams({ ll: coordinates, q: label });

    return {
        google: `https://www.google.com/maps/search/?${google}`,
        apple: `https://maps.apple.com/?${apple}`,
    };
}
