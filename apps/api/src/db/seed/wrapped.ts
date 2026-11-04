import { schema } from "@photon/db";
import { env } from "@photon/core/env";
import { eq } from "drizzle-orm";
import { generateAssetKey } from "~/lib/asset";
import type { AppContext } from "~/lib/ctx";

/** The demo event's slug, which is also how the seed knows it already ran. */
export const WRAPPED_DEMO_SLUG = "test-wrapped-utvalg";

const PHOTO_COUNT = 40;
const HOUR = 60 * 60 * 1000;

/** Made-up photographers, so the organizer sees photos from several people. */
const PHOTOGRAPHERS = [
    {
        email: "wrapped-test-1@test.com",
        name: "Kari Kamera",
        username: "kari-kamera",
    },
    {
        email: "wrapped-test-2@test.com",
        name: "Ola Blits",
        username: "ola-blits",
    },
    {
        email: "wrapped-test-3@test.com",
        name: "Nora Linse",
        username: "nora-linse",
    },
    {
        email: "wrapped-test-4@test.com",
        name: "Emil Zoom",
        username: "emil-zoom",
    },
] as const;

/**
 * A finished event with a closed camera and 40 submitted photos that nobody
 * has picked yet, arranged by Index so brotherman (test@test.com) can try the
 * organizer's selection view right away.
 *
 * Runs with the backfills because a dev database is usually seeded already.
 * It does nothing once the event exists, and nothing outside development.
 */
export async function seedWrappedDemo(ctx: AppContext): Promise<void> {
    if (env.NODE_ENV !== "development") {
        return;
    }
    const { db, bucket } = ctx;

    const existing = await db.query.event.findFirst({
        where: { slug: WRAPPED_DEMO_SLUG },
        columns: { id: true },
    });
    if (existing) {
        return;
    }

    const brotherman = await db.query.user.findFirst({
        where: { email: "test@test.com" },
        columns: { id: true },
    });
    if (!brotherman) {
        return;
    }

    let sharp: typeof import("sharp").default;
    try {
        sharp = (await import("sharp")).default;
    } catch {
        console.warn("🌱 sharp is missing, skipped the wrapped demo event.");
        return;
    }

    const member = await db.query.user.findFirst({
        where: { email: "medlem@test.com" },
        columns: { id: true },
    });
    const photographerIds = [brotherman.id];
    if (member) {
        photographerIds.push(member.id);
    }
    for (const person of PHOTOGRAPHERS) {
        photographerIds.push(await ensureUser(ctx, person));
    }

    // Yesterday evening, so the camera is closed and the photos are in.
    const end = new Date(Date.now() - 24 * HOUR);
    const start = new Date(end.getTime() - 4 * HOUR);
    const [event] = await db
        .insert(schema.event)
        .values({
            title: "Test: wrapped-utvalg",
            description:
                "Testarrangement med 40 innsendte bilder fra engangskameraet, klare til å velges ut til storyen.",
            location: "Glæzz",
            categorySlug: "sosialt",
            organizerGroupSlug: "index",
            start,
            end,
            slug: WRAPPED_DEMO_SLUG,
            enforcesPreviousStrikes: false,
        })
        .returning({ id: schema.event.id });
    if (!event) {
        return;
    }

    await db.insert(schema.wrappedCamera).values({
        eventId: event.id,
        enabled: true,
        shotsPerPerson: 10,
        storyLayout: "feed",
    });
    await db
        .insert(schema.eventRegistration)
        .values(
            photographerIds.map((userId) => ({
                eventId: event.id,
                userId,
                status: "registered" as const,
            })),
        )
        .onConflictDoNothing();

    for (let i = 0; i < PHOTO_COUNT; i++) {
        const uploadedById = photographerIds[i % photographerIds.length]!;
        const body = await sharp(Buffer.from(photoSvg(i + 1)))
            .jpeg({ quality: 80 })
            .toBuffer();
        const filename = `wrapped-demo-${i + 1}.jpg`;
        const key = generateAssetKey(filename);
        await bucket.upload(key, body, {
            originalFilename: filename,
            contentType: "image/jpeg",
            uploadedById,
            visibility: "private",
        });

        // Spread over the evening, so the list order matches the numbers.
        const takenAt = new Date(
            start.getTime() +
                ((i + 1) / (PHOTO_COUNT + 1)) *
                    (end.getTime() - start.getTime()),
        );
        await db.insert(schema.wrappedPhoto).values({
            eventId: event.id,
            uploadedById,
            assetKey: key,
            source: i % 5 === 4 ? "camera_roll" : "camera",
            submittedAt: end,
            selectedAt: null,
            createdAt: takenAt,
            updatedAt: takenAt,
        });
    }

    console.log(
        `🌱 Seeded the wrapped demo event "${WRAPPED_DEMO_SLUG}" with ${PHOTO_COUNT} photos.`,
    );
}

async function ensureUser(
    { db, auth }: AppContext,
    person: (typeof PHOTOGRAPHERS)[number],
): Promise<string> {
    const found = await db.query.user.findFirst({
        where: { email: person.email },
        columns: { id: true },
    });
    if (found) {
        return found.id;
    }

    const created = await auth.api.createUser({
        body: {
            email: person.email,
            password: "index123",
            name: person.name,
            role: "user",
            data: { username: person.username },
        },
    });
    await db
        .update(schema.user)
        .set({ emailVerified: true })
        .where(eq(schema.user.id, created.user.id));
    return created.user.id;
}

/**
 * A stand-in photo: a colour that changes with the number, a few shapes so
 * neighbours don't look alike, and the number large enough to read in a tile.
 */
function photoSvg(n: number): string {
    const hue = (n * 47) % 360;
    const width = 1080;
    const height = 1440;
    const cx = 200 + ((n * 137) % 680);
    const cy = 250 + ((n * 89) % 900);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 70%, 55%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 60) % 360}, 70%, 30%)"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${cx}" cy="${cy}" r="${120 + (n % 4) * 60}" fill="white" fill-opacity="0.18"/>
  <rect x="${(n * 61) % 700}" y="${900 + ((n * 31) % 300)}" width="360" height="220" rx="40" fill="black" fill-opacity="0.15"/>
  <text x="50%" y="52%" font-family="Helvetica, Arial, sans-serif" font-size="360" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="middle">${n}</text>
  <text x="50%" y="${height - 80}" font-family="Helvetica, Arial, sans-serif" font-size="48" fill="white" fill-opacity="0.85" text-anchor="middle">Wrapped testbilde</text>
</svg>`;
}
