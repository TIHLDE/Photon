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
