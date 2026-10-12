import { resolve } from "node:path";
import { createDb, schema } from "@photon/db";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { insertPhotoIfAllowed } from "~/lib/wrapped/quota";

/**
 * The rest of the suite runs on PGlite, which is a single connection: two
 * transactions can never overlap there, so a race for the last photo cannot
 * happen and a test for it proves nothing. This one runs against a real
 * Postgres with a connection pool, which is the only place the lock matters.
 */
describe("wrapped quota under concurrent uploads", () => {
    it("never lets a member past their limit", async ({ skip }) => {
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
                shotsPerPerson: 3,
            });
            await db.insert(schema.eventRegistration).values({
                eventId: event!.id,
                userId: "photographer",
                status: "registered",
            });

            const results = await Promise.all(
                Array.from({ length: 20 }, (_, i) =>
                    insertPhotoIfAllowed(db, {
                        eventId: event!.id,
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
            expect(
                await db.$count(
                    schema.wrappedPhoto,
                    eq(schema.wrappedPhoto.eventId, event!.id),
                ),
            ).toBe(3);
        } finally {
            await pool.end();
            await container.stop();
        }
    }, 500_000);
});
