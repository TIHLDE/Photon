import { schema } from "@photon/db";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { deleteAsset } from "~/lib/asset";
import type { AppContext } from "~/lib/ctx";
import {
    CAMERA_CLOSES_AFTER_END_MS,
    DEFAULT_SHOTS_PER_PERSON,
    cameraWindow,
    countPhotosBy,
} from "./index";
import { lockMemberPhotos } from "./quota";

type PhotoOwner = { eventId: string; userId: string };

export type SubmitResult =
    | { submittedCount: number; draftCount: number }
    | { rejected: "event_not_found" | "closed" };

/**
 * Submit the member's drafts: the ones in `photoIds`, or all of them when it is
 * omitted. Submitting a photo twice, or an id that is not one of their drafts,
 * changes nothing — so a retry is always safe.
 *
 * Only while the camera is open. After it closes the drafts are discarded, not
 * submitted late.
 */
export function submitDrafts(
    db: AppContext["db"],
    owner: PhotoOwner & { photoIds?: string[] },
    now: Date = new Date(),
): Promise<SubmitResult> {
    const { eventId, userId, photoIds } = owner;

    return db.transaction(async (tx) => {
        await lockMemberPhotos(tx, owner);

        const event = await tx.query.event.findFirst({
            where: eq(schema.event.id, eventId),
            columns: { start: true, end: true },
        });
        if (!event) return { rejected: "event_not_found" };
        if (now > cameraWindow(event).closesAt) return { rejected: "closed" };

        const drafts = and(
            eq(schema.wrappedPhoto.eventId, eventId),
            eq(schema.wrappedPhoto.uploadedById, userId),
            isNull(schema.wrappedPhoto.submittedAt),
        );

        const submitted = await tx
            .update(schema.wrappedPhoto)
            .set({ submittedAt: now })
            .where(
                photoIds
                    ? and(drafts, inArray(schema.wrappedPhoto.id, photoIds))
                    : drafts,
            )
            .returning({ id: schema.wrappedPhoto.id });

        return {
            submittedCount: submitted.length,
            draftCount: await tx.$count(schema.wrappedPhoto, drafts),
        };
    });
}

export type DeleteDraftResult =
    | { assetKey: string; shotsUsed: number; shotsLeft: number }
    | { rejected: "not_found" | "closed" | "submitted" };

/**
 * Delete one of the member's drafts. The quota counts rows, so removing the
 * row gives the shot back.
 *
 * Returns the asset key for the caller to delete once the transaction has
 * committed — removing the file first would leave a row pointing at nothing
 * if the delete then failed.
 */
export function deleteDraft(
    db: AppContext["db"],
    owner: PhotoOwner & { photoId: string },
    now: Date = new Date(),
): Promise<DeleteDraftResult> {
    const { eventId, userId, photoId } = owner;

    return db.transaction(async (tx) => {
        await lockMemberPhotos(tx, owner);

        // Matched on event and owner as well, so a guessed id never reaches
        // another member's photo — it answers exactly like a missing one.
        const where = and(
            eq(schema.wrappedPhoto.id, photoId),
            eq(schema.wrappedPhoto.eventId, eventId),
            eq(schema.wrappedPhoto.uploadedById, userId),
        );
        const [photo, event, camera] = await Promise.all([
            tx.query.wrappedPhoto.findFirst({
                where,
                columns: { assetKey: true, submittedAt: true },
            }),
            tx.query.event.findFirst({
                where: eq(schema.event.id, eventId),
                columns: { start: true, end: true },
            }),
            tx.query.wrappedCamera.findFirst({
                where: eq(schema.wrappedCamera.eventId, eventId),
                columns: { shotsPerPerson: true },
            }),
        ]);
        if (!photo || !event) return { rejected: "not_found" };
        if (now > cameraWindow(event).closesAt) return { rejected: "closed" };
        if (photo.submittedAt) return { rejected: "submitted" };

        await tx.delete(schema.wrappedPhoto).where(where);

        const shotsUsed = await countPhotosBy(tx, eventId, userId);
        const shotsPerPerson =
            camera?.shotsPerPerson ?? DEFAULT_SHOTS_PER_PERSON;
        return {
            assetKey: photo.assetKey,
            shotsUsed,
            shotsLeft: Math.max(0, shotsPerPerson - shotsUsed),
        };
    });
}

/** Rows per pass, so one run never holds a huge result in memory. */
const DISCARD_BATCH = 200;

/**
 * Discard every draft whose camera has closed: the row and the stored file.
 * Returns how many were removed.
 *
 * Until this has run, {@link visibleToOwner} and `submittedOnly` already hide
 * those drafts, so how often it runs only decides how soon the files go.
 */
export async function discardExpiredDrafts(
    ctx: Pick<AppContext, "db" | "bucket">,
    now: Date = new Date(),
): Promise<number> {
    const { db, bucket } = ctx;
    // The camera closes `CAMERA_CLOSES_AFTER_END_MS` after the event ends.
    const endedBefore = new Date(now.getTime() - CAMERA_CLOSES_AFTER_END_MS);
    let discarded = 0;

    for (;;) {
        const expired = await db
            .select({ id: schema.wrappedPhoto.id })
            .from(schema.wrappedPhoto)
            .innerJoin(
                schema.event,
                eq(schema.event.id, schema.wrappedPhoto.eventId),
            )
            .where(
                and(
                    isNull(schema.wrappedPhoto.submittedAt),
                    lt(schema.event.end, endedBefore),
                ),
            )
            .limit(DISCARD_BATCH);
        if (expired.length === 0) return discarded;

        // The submitted-at check again: a draft submitted between the select
        // and here is the member's, not ours to throw away.
        const removed = await db
            .delete(schema.wrappedPhoto)
            .where(
                and(
                    inArray(
                        schema.wrappedPhoto.id,
                        expired.map((photo) => photo.id),
                    ),
                    isNull(schema.wrappedPhoto.submittedAt),
                ),
            )
            .returning({ assetKey: schema.wrappedPhoto.assetKey });

        for (const { assetKey } of removed) {
            // One file that will not go must not keep the rest: the rows are
            // already gone, and every file left here is a file nothing owns.
            try {
                await deleteAsset(bucket, assetKey);
            } catch (error) {
                console.error(
                    `Could not delete discarded wrapped draft ${assetKey}:`,
                    error,
                );
            }
        }
        discarded += removed.length;
        if (expired.length < DISCARD_BATCH) return discarded;
    }
}
