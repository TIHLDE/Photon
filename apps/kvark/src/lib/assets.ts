const apiBase = () =>
    (import.meta.env.VITE_API_URL as string | undefined) ??
    "https://photon.tihlde.org/";

/**
 * Absolute URL for a public asset key returned by `POST /api/assets`.
 *
 * Public assets are served without authentication, so the result can be used
 * directly as an `<img src>` — unlike private attachments, which have to be
 * fetched with credentials (see `fetchPrivateObjectUrl`).
 */
export function assetPublicUrl(key: string): string {
    return new URL(`api/assets/${key}`, apiBase()).toString();
}

/**
 * Private assets — søknadsvedlegg, bøtebilder — kan ikke brukes som `<img src>`
 * / `<a href>` på tvers av origins, fordi nettleseren ikke sender sesjonen dit.
 * Hent bytene med credentials i stedet.
 *
 * Callers must revoke the URL when they are done with it.
 */
export async function fetchPrivateObjectUrl(path: string): Promise<string> {
    const response = await fetch(new URL(path, apiBase()), {
        credentials: "include",
    });
    if (!response.ok) {
        throw new Error(`Kunne ikke hente fil (${response.status})`);
    }
    return URL.createObjectURL(await response.blob());
}

/**
 * Widths `GET /api/assets/:key?w=` accepts. Must stay in sync with
 * `IMAGE_VARIANT_WIDTHS` in the API — an unlisted width is a 400, not a
 * silently full-size image.
 */
export const ASSET_IMAGE_WIDTHS = [
    160, 320, 480, 640, 960, 1280, 1920,
] as const;

export type AssetImageWidth = (typeof ASSET_IMAGE_WIDTHS)[number];

/**
 * Only asset URLs carry variants. Bundled files under `/browser-icons` and
 * `/bedrift`, and anything a third party hosts, are passed through untouched.
 */
function isAssetUrl(url: string): boolean {
    return url.includes("/api/assets/");
}

/**
 * The same image at a given width, as WebP.
 *
 * Originals are whatever was uploaded — the migrated gallery holds 2–3 MB
 * JPEGs straight off a camera — so a card that renders 320 px wide must never
 * point at one directly.
 */
export function assetImageUrl(url: string, width: AssetImageWidth): string {
    if (!isAssetUrl(url)) return url;

    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}w=${width}`;
}

/**
 * `srcSet` for an asset image, letting the browser pick by viewport and DPR.
 *
 * Returns `undefined` for non-asset URLs so callers can spread it onto an
 * `<img>` without branching.
 */
export function assetSrcSet(
    url: string,
    widths: readonly AssetImageWidth[],
): string | undefined {
    if (!isAssetUrl(url)) return undefined;

    return widths.map((w) => `${assetImageUrl(url, w)} ${w}w`).join(", ");
}

/**
 * Widths per surface, so a card and its `sizes` attribute cannot drift apart.
 *
 * `sizes` describes the rendered CSS width at each breakpoint; getting it
 * wrong is what makes a browser download the 1280 px variant for a 320 px
 * card, which is the whole problem these variants exist to solve.
 */
export const ASSET_IMAGE_SIZES = {
    /** Cards in a responsive grid: full width on phones, ~1/3 on desktop. */
    card: {
        widths: [320, 480, 640, 960] as const,
        sizes: "(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw",
    },
    /** List rows: a fixed 208 px (`sm:w-52`) thumbnail beside the text. */
    listRow: {
        widths: [320, 480, 640] as const,
        sizes: "(min-width: 640px) 208px, 100vw",
    },
    /** Detail heroes: page width, capped by the content container. */
    hero: {
        widths: [640, 960, 1280, 1920] as const,
        sizes: "(min-width: 1280px) 1200px, 100vw",
    },
    /** Gallery masonry columns. */
    galleryThumb: {
        widths: [320, 480, 640, 960] as const,
        sizes: "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
    },
} as const satisfies Record<
    string,
    { widths: readonly AssetImageWidth[]; sizes: string }
>;

export type AssetImagePreset = keyof typeof ASSET_IMAGE_SIZES;

/**
 * Avatars and group logos never render above ~80 px, so one small variant is
 * enough — no `srcSet` needed, and it keeps a member list from pulling a dozen
 * full-size profile pictures.
 */
export function avatarImageUrl(url: string): string;
export function avatarImageUrl(url: string | undefined): string | undefined;
export function avatarImageUrl(url: string | undefined): string | undefined {
    return url === undefined ? undefined : assetImageUrl(url, 160);
}

/**
 * `src`, `srcSet` and `sizes` for one surface, ready to spread onto an `<img>`.
 */
export function assetImageProps(
    url: string,
    preset: AssetImagePreset,
): { src: string; srcSet?: string; sizes?: string } {
    const { widths, sizes } = ASSET_IMAGE_SIZES[preset];
    const srcSet = assetSrcSet(url, widths);

    return {
        // The largest listed width is the fallback for browsers that ignore
        // `srcSet` — still far smaller than the original.
        src: srcSet ? assetImageUrl(url, widths[widths.length - 1]!) : url,
        srcSet,
        sizes: srcSet ? sizes : undefined,
    };
}
