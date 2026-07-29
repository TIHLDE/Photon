import { queryOptions } from "@tanstack/react-query";

/**
 * Adressesøk mot Kartverkets åpne adresse-API (Geonorge). Åpent, uten API-
 * nøkkel eller rate limit-avtale, og med CORS åpent for alle origins — derfor
 * kalles det direkte fra klienten i stedet for via Photon.
 *
 * Dekker kun norske adresser, som er det arrangementene våre trenger.
 */
const GEONORGE_SEARCH_URL = "https://ws.geonorge.no/adresser/v1/sok";

/** Minste antall tegn før vi begynner å søke. */
export const ADDRESS_SEARCH_MIN_LENGTH = 3;

const RESULT_LIMIT = 6;

export type AddressSuggestion = {
    /** Stabil nøkkel for lista. */
    id: string;
    /** Gateadressen, f.eks. "Prinsens gate 11". */
    street: string;
    /** Poststed med postnummer, f.eks. "7013 Trondheim". */
    postal: string;
    /** Hele adressen slik den lagres på arrangementet. */
    label: string;
    lat: number;
    lng: number;
};

type GeonorgeAddress = {
    adressetekst?: string | null;
    postnummer?: string | null;
    poststed?: string | null;
    representasjonspunkt?: {
        lat?: number | null;
        lon?: number | null;
    } | null;
};

type GeonorgeResponse = {
    adresser?: GeonorgeAddress[] | null;
};

/** Geonorge returnerer poststed i VERSALER — gjør om til "Trondheim". */
function toTitleCase(value: string): string {
    return value
        .toLocaleLowerCase("nb-NO")
        .replace(/(^|[\s\-/])(\p{L})/gu, (_, prefix: string, letter: string) =>
            prefix.concat(letter.toLocaleUpperCase("nb-NO")),
        );
}

function toSuggestion(
    address: GeonorgeAddress,
    index: number,
): AddressSuggestion | null {
    const street = address.adressetekst?.trim();
    const lat = address.representasjonspunkt?.lat;
    const lng = address.representasjonspunkt?.lon;

    if (!street || typeof lat !== "number" || typeof lng !== "number") {
        return null;
    }

    const postal = [
        address.postnummer?.trim(),
        address.poststed ? toTitleCase(address.poststed.trim()) : null,
    ]
        .filter(Boolean)
        .join(" ");

    return {
        id: `${street}-${postal}-${lat}-${lng}-${index}`,
        street,
        postal,
        label: postal ? `${street}, ${postal}` : street,
        lat,
        lng,
    };
}

async function searchAddresses(
    query: string,
    signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
    const params = new URLSearchParams({
        sok: query,
        treffPerSide: String(RESULT_LIMIT),
        fuzzy: "true",
        filtrer: [
            "adresser.adressetekst",
            "adresser.postnummer",
            "adresser.poststed",
            "adresser.representasjonspunkt",
        ].join(","),
    });

    const response = await fetch(`${GEONORGE_SEARCH_URL}?${params}`, {
        signal,
        headers: { Accept: "application/json" },
    });
    if (!response.ok) {
        throw new Error(`Adressesøk feilet (${response.status})`);
    }

    const body = (await response.json()) as GeonorgeResponse;
    return (body.adresser ?? [])
        .map(toSuggestion)
        .filter((suggestion): suggestion is AddressSuggestion =>
            Boolean(suggestion),
        );
}

export const searchAddressQuery = (query: string) => {
    const trimmed = query.trim();
    return queryOptions({
        queryKey: ["address", "search", trimmed] as const,
        queryFn: ({ signal }) => searchAddresses(trimmed, signal),
        enabled: trimmed.length >= ADDRESS_SEARCH_MIN_LENGTH,
        // Adresseregisteret endrer seg sjelden; hold treffene varme mens
        // brukeren fyller ut resten av skjemaet.
        staleTime: 10 * 60 * 1000,
        retry: 1,
    });
};
