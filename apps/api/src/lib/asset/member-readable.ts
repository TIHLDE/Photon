import { schema } from "@photon/db";
import { type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { AppContext } from "~/lib/ctx";

// Referansen avgjør, framfor en tredje visibility-verdi: Drizzle-snapshotet har
// utestående DROP TABLE-er etter #732, så enhver skjemaendring drar dem med seg
// inn i migrasjonen.
const answers = new Map<string, boolean>();

// Suffiks-sammenligning framfor LIKE, fordi nøklene inneholder `_`.
function pointsAtKey(column: PgColumn, key: string): SQL {
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
    const cached = answers.get(key);
    if (cached !== undefined) return cached;

    const sources = [
        ctx.db
            .select({ found: schema.galleryPicture.id })
            .from(schema.galleryPicture)
            .where(pointsAtKey(schema.galleryPicture.imageUrl, key))
            .limit(1),
        ctx.db
            .select({ found: schema.galleryAlbum.id })
            .from(schema.galleryAlbum)
            .where(pointsAtKey(schema.galleryAlbum.imageUrl, key))
            .limit(1),
        // Opplastet avatar ligger i user_settings, mens auth_user.image er
        // den fra Feide — og fra Lepton-importen, som skrev dit.
        ctx.db
            .select({ found: schema.userSettings.userId })
            .from(schema.userSettings)
            .where(pointsAtKey(schema.userSettings.imageUrl, key))
            .limit(1),
        ctx.db
            .select({ found: schema.user.id })
            .from(schema.user)
            .where(pointsAtKey(schema.user.image, key))
            .limit(1),
    ];

    for (const source of sources) {
        if ((await source).length > 0) {
            // Hvilken rad en nøkkel hører til endrer seg aldri.
            answers.set(key, true);
            return true;
        }
    }

    return false;
}

export const clearMemberReadableCache = () => answers.clear();
