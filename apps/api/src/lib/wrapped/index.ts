import { schema } from "@photon/db";
import type { RegistrationStatus } from "@photon/db/schema";
import { and, eq } from "drizzle-orm";
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

    const [camera, registration, shotsUsed] = await Promise.all([
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
    ]);

    const enabled = camera?.enabled ?? false;
    const shotsPerPerson = camera?.shotsPerPerson ?? DEFAULT_SHOTS_PER_PERSON;
    const shotsLeft = Math.max(0, shotsPerPerson - shotsUsed);
    const { opensAt, closesAt } = cameraWindow(event);

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
