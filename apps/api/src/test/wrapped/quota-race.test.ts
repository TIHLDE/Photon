import { resolve } from "node:path";
import { createDb, schema } from "@photon/db";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { deleteDraft } from "~/lib/wrapped/drafts";
import { insertPhotoIfAllowed } from "~/lib/wrapped/quota";

/**
 * The rest of the suite runs on PGlite, which is a single connection: two
 * transactions can never overlap there, so a race for the last photo cannot
 * happen and a test for it proves nothing. This one runs against a real
 * Postgres with a connection pool, which is the only place the lock matters.
 */
type Db = ReturnType<typeof createDb>;

/**
 * A real Postgres with a member registered at an event whose camera allows
 * `shotsPerPerson` photos. Skips when Docker is not there, except in CI.
 */
async function withCamera(
    skip: () => void,
    shotsPerPerson: number,
    run: (db: Db, eventId: string) => Promise<void>,
): Promise<void> {
    let container: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
    try {
        container = await new PostgreSqlContainer("postgres:17").start();
    } catch (error) {
        // Needs Docker. Locally that may be off; in CI it is a failure.
        if (process.env.CI) throw error;
        console.warn("Skipping: could not start Postgres", error);
        return skip();
    }

    const pool = new Pool({
        connectionString: container.getConnectionUri(),
    });
    const db = createDb({ pool });

    try {
        await migrate(db, {
            migrationsFolder: resolve(
                process.cwd(),
                "../../packages/db/drizzle",
            ),
        });

        const now = new Date();
        await db.insert(schema.user).values({
            id: "photographer",
            name: "Fotograf",
            email: "fotograf@example.com",
            createdAt: now,
            updatedAt: now,
        });
        await db
            .insert(schema.eventCategory)
            .values({ slug: "sosialt", label: "Sosialt" });
        const [event] = await db
            .insert(schema.event)
            .values({
                title: "Botfest",
                slug: "botfest",
                categorySlug: "sosialt",
                start: now,
                end: now,
                enforcesPreviousStrikes: true,
            })
            .returning({ id: schema.event.id });
        await db.insert(schema.wrappedCamera).values({
            eventId: event!.id,
            enabled: true,
            shotsPerPerson,
        });
        await db.insert(schema.eventRegistration).values({
            eventId: event!.id,
            userId: "photographer",
            status: "registered",
        });

        await run(db, event!.id);
    } finally {
        await pool.end();
        await container.stop();
    }
}

function photoCount(db: Db, eventId: string) {
    return db.$count(
        schema.wrappedPhoto,
        eq(schema.wrappedPhoto.eventId, eventId),
    );
}

describe("wrapped quota under concurrent uploads", () => {
    it("never lets a member past their limit", async ({ skip }) => {
        await withCamera(skip, 3, async (db, eventId) => {
            const results = await Promise.all(
                Array.from({ length: 20 }, (_, i) =>
                    insertPhotoIfAllowed(db, {
                        eventId,
                        userId: "photographer",
                        assetKey: `uploads/2026/11/photo-${i}.webp`,
                    }),
                ),
            );

            expect(results.filter((r) => "id" in r)).toHaveLength(3);
            expect(results.filter((r) => "rejected" in r)).toEqual(
                Array.from({ length: 17 }, () => ({
                    rejected: "no_shots_left",
                })),
            );
            expect(await photoCount(db, eventId)).toBe(3);
        });
    }, 500_000);

    it("a delete racing uploads frees exactly one shot", async ({ skip }) => {
        await withCamera(skip, 2, async (db, eventId) => {
            const owner = { eventId, userId: "photographer" };
            const first = await insertPhotoIfAllowed(db, {
                ...owner,
                assetKey: "uploads/2026/11/first.webp",
            });
            await insertPhotoIfAllowed(db, {
                ...owner,
                assetKey: "uploads/2026/11/second.webp",
            });
            if (!("id" in first)) throw new Error("Seed photo was rejected");

            const [deleted, ...uploads] = await Promise.all([
                deleteDraft(db, { ...owner, photoId: first.id }),
                ...Array.from({ length: 10 }, (_, i) =>
                    insertPhotoIfAllowed(db, {
                        ...owner,
                        assetKey: `uploads/2026/11/race-${i}.webp`,
                    }),
                ),
            ]);

            expect(deleted).toHaveProperty("assetKey");
            // Whether an upload got in depends on who took the lock first —
            // but never more than the one shot the delete gave back.
            const landed = uploads.filter((r) => "id" in r).length;
            expect(landed).toBeLessThanOrEqual(1);
            expect(await photoCount(db, eventId)).toBe(1 + landed);
        });
    }, 500_000);
});
