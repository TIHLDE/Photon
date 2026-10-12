import { schema } from "@photon/db";
import { eq, sql } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import { type CameraBlockedReason, readShootState } from "./index";

export type PhotoInsertResult =
    | { id: string; shotsUsed: number; shotsLeft: number; replayed: boolean }
    | { rejected: CameraBlockedReason | "event_not_found" | "key_in_use" };

type PhotoOwner = { eventId: string; userId: string };

/**
 * Whether `id` is already a photo, and whose.
 *
 * A client that never got the answer to an upload sends it again under the
 * same id. If that photo is theirs, at this event, the first attempt landed
 * and the second must not cost another photo. If it is anyone else's, the id
 * is not theirs to use.
 */
export async function findPhotoReplay(
    db: Pick<AppContext["db"], "query">,
    id: string,
    owner: PhotoOwner,
): Promise<"mine" | "taken" | null> {
    const existing = await db.query.wrappedPhoto.findFirst({
        where: eq(schema.wrappedPhoto.id, id),
        columns: { eventId: true, uploadedById: true },
    });
    if (!existing) return null;

    return existing.eventId === owner.eventId &&
        existing.uploadedById === owner.userId
        ? "mine"
        : "taken";
}

/**
 * Record a photo for `userId`, if they may still take one.
 *
 * The status a request read when it started is not enough, for two reasons.
 * Two uploads racing for the last photo both see one left. And receiving the
 * file takes as long as the client wants it to, so by the time it is stored
 * the camera may have been turned off, closed, or given a lower limit.
 *
 * So everything is asked again here, behind an advisory lock that makes the
 * check and the insert a single step per member and event. The lock is
 * released when the transaction ends, and members shooting at the same event
 * never wait on each other — only on their own second tap.
 *
 * `id` is the client's own id for the photo. A second attempt under the same
 * id finds the first and answers with it instead of inserting again.
 */
export function insertPhotoIfAllowed(
    db: AppContext["db"],
    photo: PhotoOwner & { assetKey: string; id?: string },
    now: Date = new Date(),
): Promise<PhotoInsertResult> {
    const { eventId, userId, assetKey, id } = photo;

    return db.transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtextextended(${`wrapped:${eventId}:${userId}`}, 0))`,
        );

        const state = await readShootState(tx, eventId, userId, now);
        if (!state) return { rejected: "event_not_found" };

        // Before the reasons: a photo that already landed is still theirs
        // after the camera has closed or the last photo is spent.
        const replay = id ? await findPhotoReplay(tx, id, photo) : null;
        if (id && replay === "mine") {
            return {
                id,
                shotsUsed: state.shotsUsed,
                shotsLeft: state.shotsLeft,
                replayed: true,
            };
        }
        if (replay === "taken") return { rejected: "key_in_use" };

        if (state.reason) return { rejected: state.reason };

        const [row] = await tx
            .insert(schema.wrappedPhoto)
            .values({ id, eventId, uploadedById: userId, assetKey })
            .returning({ id: schema.wrappedPhoto.id });
        if (!row) throw new Error("Insert returned no row");

        return {
            id: row.id,
            shotsUsed: state.shotsUsed + 1,
            shotsLeft: state.shotsLeft - 1,
            replayed: false,
        };
    });
}
