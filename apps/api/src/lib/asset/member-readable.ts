import { schema } from "@photon/db";
import { type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { AppContext } from "~/lib/ctx";
import { assetKeyFromUrl } from "./index";

// Referansen avgjør, framfor en tredje visibility-verdi: Drizzle-snapshotet har
// utestående DROP TABLE-er etter #732, så enhver skjemaendring drar dem med seg
// inn i migrasjonen.
const ANSWER_TTL_MS = 60_000;
const MAX_CACHED_ANSWERS = 10_000;
const IMPORTED_AVATAR_PREFIX = "profile-images/";
const readableUntil = new Map<string, number>();

// Suffiks-sammenligning framfor LIKE, fordi nøklene inneholder `_`.
function endsWithAssetPath(column: PgColumn, key: string): SQL {
    const url = `/api/assets/${key}`;
    return sql`right(${column}, ${url.length}) = ${url}`;
}

/**
 * Whether a private asset is one every signed-in member may read — a
 * galleribilde, en albumforside eller et profilbilde. Kontraktsignaturer,
 * søknadsvedlegg og bøtebilder er ikke det: de serveres bare av en rute som
 * autoriserer den enkelte kalleren.
 */
export async function isMemberReadableAsset(
    ctx: AppContext,
    key: string,
): Promise<boolean> {
    const until = readableUntil.get(key);
    if (until !== undefined) {
        if (until > Date.now()) return true;
        readableUntil.delete(key);
    }

    const readable =
        (await isGalleryAsset(ctx, key)) || (await isAvatarAsset(ctx, key));

    if (readable) {
        // Raden kan forsvinne, så et ja gjelder bare en kort stund.
        if (readableUntil.size >= MAX_CACHED_ANSWERS) readableUntil.clear();
        readableUntil.set(key, Date.now() + ANSWER_TTL_MS);
    }

    return readable;
}

async function isGalleryAsset(ctx: AppContext, key: string): Promise<boolean> {
    const pictures = await ctx.db
        .select({ url: schema.galleryPicture.imageUrl })
        .from(schema.galleryPicture)
        .where(endsWithAssetPath(schema.galleryPicture.imageUrl, key));
    const albums = await ctx.db
        .select({ url: schema.galleryAlbum.imageUrl })
        .from(schema.galleryAlbum)
        .where(endsWithAssetPath(schema.galleryAlbum.imageUrl, key));

    return [...pictures, ...albums].some(({ url }) => pointsAt(url, key));
}

/**
 * Bare medlemmets eget bilde teller: `user_settings` har rader fra før
 * opplaster ble sjekket ved lagring, og `auth_user.image` har rader fra da
 * medlemmet kunne sette den selv gjennom Better Auth, uten noen sjekk.
 *
 * Uten opplaster er enten importert (gjenopprettingen i juli 2026 registrerte
 * ingen) eller lastet opp av en konto som senere ble slettet eller slått
 * sammen. Derfor godtas det i `auth_user.image` bare under importens eget
 * prefiks, så kolonnen ikke åpner vedleggene til et slettet medlem.
 */
async function isAvatarAsset(ctx: AppContext, key: string): Promise<boolean> {
    // Opplastet avatar ligger i user_settings, mens auth_user.image er den fra
    // Feide — og fra Lepton-importen, som skrev dit.
    const settings = await ctx.db
        .select({
            url: schema.userSettings.imageUrl,
            userId: schema.userSettings.userId,
        })
        .from(schema.userSettings)
        .where(endsWithAssetPath(schema.userSettings.imageUrl, key));
    const users = await ctx.db
        .select({ url: schema.user.image, userId: schema.user.id })
        .from(schema.user)
        .where(endsWithAssetPath(schema.user.image, key));

    const settingsRows = settings.filter(({ url }) => pointsAt(url, key));
    const userRows = users.filter(({ url }) => pointsAt(url, key));
    if (settingsRows.length === 0 && userRows.length === 0) return false;

    const uploader = (await ctx.bucket.getAsset(key))?.uploadedById;
    if (uploader === undefined) return false;

    if (uploader === null) {
        return (
            settingsRows.length > 0 || key.startsWith(IMPORTED_AVATAR_PREFIX)
        );
    }

    return [...settingsRows, ...userRows].some(
        ({ userId }) => userId === uploader,
    );
}

// Suffikset alene holder ikke: `https://x/?a=/api/assets/<nøkkel>` ender likt,
// men peker ikke på filen og slipper derfor gjennom eierskapssjekken.
function pointsAt(url: string | null, key: string): boolean {
    return url !== null && assetKeyFromUrl(url) === key;
}

export const clearMemberReadableCache = () => readableUntil.clear();
