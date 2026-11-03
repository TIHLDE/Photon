import { schema } from "@photon/db";
import type { RegistrationStatus } from "@photon/db/schema";
import { eq } from "drizzle-orm";
import { submitClosedDrafts } from "~/lib/wrapped/drafts";
import type { IntegrationTestContext } from "~/test/config/integration";

type TestUser = Awaited<
    ReturnType<IntegrationTestContext["utils"]["createTestUser"]>
>;

const HOUR = 60 * 60 * 1000;

/** An event that is under way, so its camera window is open right now. */
export async function createOngoingEvent(
    ctx: IntegrationTestContext,
    overrides?: Parameters<
        IntegrationTestContext["utils"]["createTestEvent"]
    >[0],
) {
    await ctx.utils.setupGroups();
    await ctx.utils.setupEventCategories();

    const now = Date.now();
    return ctx.utils.createTestEvent({
        slug: `wrapped-${crypto.randomUUID()}`,
        start: new Date(now - HOUR),
        end: new Date(now + HOUR),
        ...overrides,
    });
}

export async function enableCamera(
    ctx: IntegrationTestContext,
    eventId: string,
    shotsPerPerson = 5,
) {
    await ctx.db
        .insert(schema.wrappedCamera)
        .values({ eventId, enabled: true, shotsPerPerson });
}

export async function register(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
    status: RegistrationStatus = "registered",
) {
    await ctx.db
        .insert(schema.eventRegistration)
        .values({ eventId, userId, status });
}

/**
 * The typed test client pins `Content-Type: application/json`, which breaks a
 * multipart body — so uploads go through `app.request` with the cookie alone.
 */
export async function sessionCookie(
    ctx: IntegrationTestContext,
    user: TestUser,
): Promise<string> {
    const response = await ctx.auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        returnHeaders: true,
    });
    const cookie = response.headers.getSetCookie()[0]?.split(";")[0];
    if (!cookie) throw new Error("Sign-in returned no session cookie");
    return cookie;
}

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function uploadPhoto(
    ctx: IntegrationTestContext,
    cookie: string,
    eventId: string,
    file: { type: string; name: string; content?: Buffer } = {
        type: "image/png",
        name: "bilde.png",
    },
    idempotencyKey?: string,
) {
    const body = new FormData();
    body.append(
        "file",
        new Blob(
            [
                new Uint8Array(
                    file.content ??
                        Buffer.concat([
                            Buffer.from(PNG_HEADER),
                            Buffer.from("bilde"),
                        ]),
                ),
            ],
            { type: file.type },
        ),
        file.name,
    );

    const query = idempotencyKey ? `?idempotencyKey=${idempotencyKey}` : "";
    return ctx.app.request(`/api/event/${eventId}/wrapped/photos${query}`, {
        method: "POST",
        body,
        headers: { Cookie: cookie },
    });
}

/** Move the event back so its camera closed an hour ago. */
export async function closeCamera(
    ctx: IntegrationTestContext,
    eventId: string,
) {
    const now = Date.now();
    await ctx.db
        .update(schema.event)
        .set({ start: new Date(now - 8 * HOUR), end: new Date(now - 5 * HOUR) })
        .where(eq(schema.event.id, eventId));
}

/**
 * Close the camera and run the sweep: how photos reach the organizer in
 * production.
 */
export async function closeAndSubmit(
    ctx: IntegrationTestContext,
    eventId: string,
) {
    await closeCamera(ctx, eventId);
    return submitClosedDrafts(ctx.db);
}

/**
 * An event whose camera has been used and closed: one photographer has taken
 * `count` photos, the sweep has sent them in, and the organizer has picked
 * all of them. The story is not published.
 */
export async function eventWithPickedPhotos(
    ctx: IntegrationTestContext,
    count: number,
) {
    const event = await createOngoingEvent(ctx);
    await enableCamera(ctx, event.id, Math.max(count, 1));

    const photographer = await ctx.utils.createTestUser();
    await register(ctx, event.id, photographer.id);
    const cookie = await sessionCookie(ctx, photographer);
    for (let i = 0; i < count; i++) {
        await uploadPhoto(ctx, cookie, event.id);
    }
    if (count > 0) {
        await closeAndSubmit(ctx, event.id);
    }
    await ctx.db
        .update(schema.wrappedPhoto)
        .set({ selectedAt: new Date() })
        .where(eq(schema.wrappedPhoto.eventId, event.id));

    const organizer = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(organizer, ["events:update"]);

    return { event, photographer, organizer, cookie };
}

/** Put the event's story live directly, without notifying anybody. */
export async function markPublished(
    ctx: IntegrationTestContext,
    eventId: string,
) {
    const now = new Date();
    await ctx.db
        .update(schema.wrappedCamera)
        .set({ publishedAt: now, firstPublishedAt: now })
        .where(eq(schema.wrappedCamera.eventId, eventId));
}
