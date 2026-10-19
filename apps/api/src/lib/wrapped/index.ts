import { schema } from "@photon/db";
import type { RegistrationStatus } from "@photon/db/schema";
import {
    type SQL,
    and,
    count,
    eq,
    gte,
    inArray,
    isNotNull,
    isNull,
    lte,
} from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import {
    DEFAULT_STATUSES,
    EVENT_ARRANGER_PERMISSIONS,
    canActOnEvent,
} from "~/lib/event/access";

/** The camera opens this long before `event.start`. */
export const CAMERA_OPENS_BEFORE_START_MS = 2 * 60 * 60 * 1000;
/** The camera stays open this long after `event.end`. */
export const CAMERA_CLOSES_AFTER_END_MS = 4 * 60 * 60 * 1000;

export const DEFAULT_SHOTS_PER_PERSON = 5;
export const MAX_SHOTS_PER_PERSON = 20;

/**
 * Whoever arranges the event curates its photos — the same people who may
 * edit it, globally or scoped to the arranging group.
 */
export const WRAPPED_ARRANGER_PERMISSIONS = [...EVENT_ARRANGER_PERMISSIONS];

/**
 * Why a member cannot take a photo right now. The order is part of the API:
 * the first reason that applies is the one reported, so the camera screen can
 * say "ikke åpnet ennå" to someone who is also not registered.
 */
export const cameraBlockedReasons = [
    "disabled",
    "not_open_yet",
    "closed",
    "not_registered",
    "no_shots_left",
] as const;

export type CameraBlockedReason = (typeof cameraBlockedReasons)[number];

export type CameraStatus = {
    enabled: boolean;
    shotsPerPerson: number;
    opensAt: Date;
    closesAt: Date;
    isOpen: boolean;
    shotsUsed: number;
    shotsLeft: number;
    canShoot: boolean;
    reason: CameraBlockedReason | null;
    /** The caller's photos not yet submitted. Always 0 once the camera has closed. */
    draftCount: number;
    canManage: boolean;
};

/**
 * The window is plain arithmetic on instants, so it needs no time zone: it is
 * never bucketed into a calendar day.
 */
export function cameraWindow(event: { start: Date; end: Date }): {
    opensAt: Date;
    closesAt: Date;
} {
    return {
        opensAt: new Date(event.start.getTime() - CAMERA_OPENS_BEFORE_START_MS),
        closesAt: new Date(event.end.getTime() + CAMERA_CLOSES_AFTER_END_MS),
    };
}

export function blockedReason(input: {
    enabled: boolean;
    opensAt: Date;
    closesAt: Date;
    hasSpot: boolean;
    shotsLeft: number;
    now: Date;
}): CameraBlockedReason | null {
    if (!input.enabled) return "disabled";
    if (input.now < input.opensAt) return "not_open_yet";
    if (input.now > input.closesAt) return "closed";
    if (!input.hasSpot) return "not_registered";
    if (input.shotsLeft <= 0) return "no_shots_left";
    return null;
}

/**
 * The statuses that hold a spot. `no_show` counts: the no-show sweep runs once
 * the event has ended, while the camera is still open, and must not lock out
 * someone who was there but never got checked in.
 */
export function holdsSpot(status: RegistrationStatus | undefined): boolean {
    return (
        status !== undefined &&
        (DEFAULT_STATUSES as readonly RegistrationStatus[]).includes(status)
    );
}

/**
 * Photos the member has submitted. The organizer only ever sees these: every
 * organizer query goes through this condition.
 */
export function submittedOnly(): SQL {
    return isNotNull(schema.wrappedPhoto.submittedAt);
}

/**
 * The member's own photos they may still see: all of them while the camera is
 * open, only the submitted ones after it has closed. Drafts left at closing
 * are discarded — by {@link discardExpiredDrafts}, and until that has run,
 * by this condition.
 */
export function visibleToOwner(
    closesAt: Date,
    now: Date = new Date(),
): SQL | undefined {
    return now > closesAt ? submittedOnly() : undefined;
}

/**
 * Every photo the member holds at the event, drafts included: a draft costs a
 * shot until it is deleted.
 */
export function countPhotosBy(
    db: Pick<Reader, "$count">,
    eventId: string,
    userId: string,
): Promise<number> {
    return db.$count(
        schema.wrappedPhoto,
        and(
            eq(schema.wrappedPhoto.eventId, eventId),
            eq(schema.wrappedPhoto.uploadedById, userId),
        ),
    );
}

/** A database handle or a transaction: both can read. */
type Reader = Pick<AppContext["db"], "$count" | "query">;

/**
 * Whether one member may take a photo at one event right now, or null when
 * the event does not exist. Everything in {@link CameraStatus} that decides
 * that — which is all of it except `canManage`.
 *
 * Takes a reader so the upload can ask again inside its transaction: the
 * answer a request got when it started is not the answer that counts by the
 * time its file has been received.
 */
export async function readShootState(
    db: Reader,
    eventId: string,
    userId: string,
    now: Date = new Date(),
): Promise<Omit<CameraStatus, "canManage"> | null> {
    const event = await db.query.event.findFirst({
        where: eq(schema.event.id, eventId),
        columns: { start: true, end: true },
    });
    if (!event) return null;

    const { opensAt, closesAt } = cameraWindow(event);

    const [camera, registration, shotsUsed, draftCount] = await Promise.all([
        db.query.wrappedCamera.findFirst({
            where: eq(schema.wrappedCamera.eventId, eventId),
        }),
        db.query.eventRegistration.findFirst({
            where: and(
                eq(schema.eventRegistration.eventId, eventId),
                eq(schema.eventRegistration.userId, userId),
            ),
            columns: { status: true },
        }),
        countPhotosBy(db, eventId, userId),
        now > closesAt
            ? 0
            : db.$count(
                  schema.wrappedPhoto,
                  and(
                      eq(schema.wrappedPhoto.eventId, eventId),
                      eq(schema.wrappedPhoto.uploadedById, userId),
                      isNull(schema.wrappedPhoto.submittedAt),
                  ),
              ),
    ]);

    const enabled = camera?.enabled ?? false;
    const shotsPerPerson = camera?.shotsPerPerson ?? DEFAULT_SHOTS_PER_PERSON;
    const shotsLeft = Math.max(0, shotsPerPerson - shotsUsed);

    const reason = blockedReason({
        enabled,
        opensAt,
        closesAt,
        hasSpot: holdsSpot(registration?.status),
        shotsLeft,
        now,
    });

    return {
        enabled,
        shotsPerPerson,
        opensAt,
        closesAt,
        isOpen: enabled && now >= opensAt && now <= closesAt,
        shotsUsed,
        shotsLeft,
        canShoot: reason === null,
        reason,
        draftCount,
    };
}

/**
 * Everything the camera screen needs to know about one member and one event,
 * or null when the event does not exist.
 */
export async function getCameraStatus(
    ctx: AppContext,
    eventId: string,
    userId: string,
    now: Date = new Date(),
): Promise<CameraStatus | null> {
    const [state, canManage] = await Promise.all([
        readShootState(ctx.db, eventId, userId, now),
        canActOnEvent(ctx, userId, eventId, WRAPPED_ARRANGER_PERMISSIONS),
    ]);

    return state && { ...state, canManage };
}

export type OpenCamera = {
    eventId: string;
    slug: string;
    title: string;
    start: Date;
    end: Date;
    closesAt: Date;
    shotsPerPerson: number;
    shotsLeft: number;
    draftCount: number;
};

/**
 * The cameras `userId` can use right now: turned on, inside their window, at
 * an event they hold a spot on, with photos left or drafts to submit.
 *
 * Ordered by how much it is "the event you are at": events under way come
 * first, the one that started last on top — at 22:30 the party that began at
 * 22:00 beats the meeting that ended at 20:00 and still has its camera open.
 * Cameras that have opened ahead of their event follow, soonest first, and
 * events that are over come last.
 */
export async function listOpenCameras(
    db: AppContext["db"],
    userId: string,
    now: Date = new Date(),
): Promise<OpenCamera[]> {
    const cameras = await db
        .select({
            eventId: schema.event.id,
            slug: schema.event.slug,
            title: schema.event.title,
            start: schema.event.start,
            end: schema.event.end,
            shotsPerPerson: schema.wrappedCamera.shotsPerPerson,
        })
        .from(schema.wrappedCamera)
        .innerJoin(
            schema.event,
            eq(schema.event.id, schema.wrappedCamera.eventId),
        )
        .innerJoin(
            schema.eventRegistration,
            and(
                eq(schema.eventRegistration.eventId, schema.event.id),
                eq(schema.eventRegistration.userId, userId),
                inArray(schema.eventRegistration.status, [...DEFAULT_STATUSES]),
            ),
        )
        .where(
            and(
                eq(schema.wrappedCamera.enabled, true),
                // The same window as `cameraWindow`, turned around so the
                // comparison is against the stored columns.
                lte(
                    schema.event.start,
                    new Date(now.getTime() + CAMERA_OPENS_BEFORE_START_MS),
                ),
                gte(
                    schema.event.end,
                    new Date(now.getTime() - CAMERA_CLOSES_AFTER_END_MS),
                ),
            ),
        );
    if (cameras.length === 0) return [];

    const used = await db
        .select({
            eventId: schema.wrappedPhoto.eventId,
            photos: count(),
            // `count(column)` skips nulls, so this counts the submitted ones.
            submitted: count(schema.wrappedPhoto.submittedAt),
        })
        .from(schema.wrappedPhoto)
        .where(
            and(
                eq(schema.wrappedPhoto.uploadedById, userId),
                inArray(
                    schema.wrappedPhoto.eventId,
                    cameras.map((camera) => camera.eventId),
                ),
            ),
        )
        .groupBy(schema.wrappedPhoto.eventId);
    const usedByEvent = new Map(used.map((row) => [row.eventId, row]));

    // 0: under way, 1: camera open ahead of the event, 2: event over.
    const rank = (camera: { start: Date; end: Date }) =>
        now < camera.start ? 1 : now > camera.end ? 2 : 0;

    return (
        cameras
            .map((camera) => {
                const used = usedByEvent.get(camera.eventId);
                return {
                    ...camera,
                    closesAt: cameraWindow(camera).closesAt,
                    shotsLeft: Math.max(
                        0,
                        camera.shotsPerPerson - (used?.photos ?? 0),
                    ),
                    draftCount: (used?.photos ?? 0) - (used?.submitted ?? 0),
                };
            })
            // A camera with no shots left still matters while drafts wait to be
            // submitted: that is the only way back to them.
            .filter((camera) => camera.shotsLeft > 0 || camera.draftCount > 0)
            .sort((a, b) => {
                if (rank(a) !== rank(b)) return rank(a) - rank(b);
                // Under way: the one that started last. Ahead: the one that starts
                // first. Over: the one that ended last.
                if (rank(a) === 0) return b.start.getTime() - a.start.getTime();
                if (rank(a) === 1) return a.start.getTime() - b.start.getTime();
                return b.end.getTime() - a.end.getTime();
            })
    );
}
