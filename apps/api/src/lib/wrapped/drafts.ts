import { schema } from "@photon/db";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import {
    AUTO_SUBMIT_AFTER_CLOSE_MS,
    CAMERA_CLOSES_AFTER_END_MS,
    DEFAULT_SHOTS_PER_PERSON,
    cameraWindow,
    countPhotosBy,
} from "./index";
import { lockMemberPhotos } from "./quota";

type PhotoOwner = { eventId: string; userId: string };

export type DeleteDraftResult =
    | { assetKey: string; shotsUsed: number; shotsLeft: number }
    | { rejected: "not_found" | "closed" | "submitted" };

/**
 * Delete any of the member's drafts, until a minute after the camera closes.
 * The quota counts rows, so removing the row gives the shot back.
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
                where: { id: photoId, eventId, uploadedById: userId },
                columns: { assetKey: true, submittedAt: true },
            }),
            tx.query.event.findFirst({
                where: { id: eventId },
                columns: { start: true, end: true },
            }),
            tx.query.wrappedCamera.findFirst({
                where: { eventId },
                columns: { shotsPerPerson: true },
            }),
        ]);
        if (!photo || !event) return { rejected: "not_found" };
        if (
            now.getTime() >
            cameraWindow(event).closesAt.getTime() + AUTO_SUBMIT_AFTER_CLOSE_MS
        ) {
            return { rejected: "closed" };
        }
        if (photo.submittedAt) return { rejected: "submitted" };

        // Guarded on submitted_at too: the sweep may have submitted the row
        // since the read above, and a submitted photo is the organizer's.
        const deleted = await tx
            .delete(schema.wrappedPhoto)
            .where(and(where, isNull(schema.wrappedPhoto.submittedAt)))
            .returning({ id: schema.wrappedPhoto.id });
        if (deleted.length === 0) return { rejected: "submitted" };

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

/**
 * Send every draft whose camera closed more than `AUTO_SUBMIT_AFTER_CLOSE_MS`
 * ago to the organizer, by setting `submitted_at`. Returns how many photos that
 * was and at which events.
 *
 * Idempotent: the `submitted_at is null` condition means a second run, a late
 * run or two instances change nothing twice. No member lock is needed: this
 * UPDATE and the guarded DELETE in `deleteDraft` both re-check `submitted_at`
 * under the row lock, so whichever commits first wins. A submitted photo is
 * never deleted, and a deleted one is never submitted.
 *
 * ponytail: a sweep, not a job per camera, so the organizer sees these photos
 * at most one tick after the grace minute. No index on submitted_at; add a
 * partial index if wrapped_photo grows large. `updatedAt` is set by $onUpdate.
 */
export async function submitClosedDrafts(
    db: AppContext["db"],
    now: Date = new Date(),
): Promise<{ submitted: number; eventIds: string[] }> {
    const endedBefore = new Date(
        now.getTime() - CAMERA_CLOSES_AFTER_END_MS - AUTO_SUBMIT_AFTER_CLOSE_MS,
    );
    const rows = await db
        .update(schema.wrappedPhoto)
        .set({ submittedAt: now })
        .where(
            and(
                isNull(schema.wrappedPhoto.submittedAt),
                inArray(
                    schema.wrappedPhoto.eventId,
                    db
                        .select({ id: schema.event.id })
                        .from(schema.event)
                        .where(lt(schema.event.end, endedBefore)),
                ),
            ),
        )
        .returning({ eventId: schema.wrappedPhoto.eventId });

    return {
        submitted: rows.length,
        eventIds: [...new Set(rows.map((row) => row.eventId))],
    };
}
