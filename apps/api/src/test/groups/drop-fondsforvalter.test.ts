import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DbSchema, schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Migration 0072 removes the `fondsforvalter` stub left by the Lepton import.
 *
 * Deleting a group cascades over ten foreign keys, so the delete is guarded on
 * all of them: if anything has been attached since the counts were taken, the
 * statement matches nothing and the group survives for a human to look at.
 * These tests exercise the shipped SQL rather than a restatement of it — a
 * guard that has drifted from the one production ran proves nothing.
 */

const SLUG = "fondsforvalter";

const migration = async () => {
    const file = await readFile(
        resolve(
            process.cwd(),
            "../../packages/db/drizzle/0072_drop_fondsforvalter_stub.sql",
        ),
        "utf8",
    );
    return file.split("--> statement-breakpoint");
};

const runMigration = async (db: NodePgDatabase<DbSchema>) => {
    for (const statement of await migration()) {
        await db.execute(sql.raw(statement));
    }
};

const seedStub = async (db: NodePgDatabase<DbSchema>) => {
    await db
        .insert(schema.group)
        .values({
            slug: SLUG,
            name: "Fondsforvalter",
            type: "STUDY",
            finesInfo: "",
            finesActivated: false,
        })
        .onConflictDoNothing();
};

const stubExists = async (db: NodePgDatabase<DbSchema>) => {
    const rows = await db
        .select({ slug: schema.group.slug })
        .from(schema.group)
        .where(eq(schema.group.slug, SLUG));
    return rows.length === 1;
};

describe("fjerning av fondsforvalter-stubben", () => {
    integrationTest(
        "fjerner gruppa og dens ene medlemskap",
        async ({ ctx }) => {
            await seedStub(ctx.db);
            const user = await ctx.utils.createTestUser();
            await ctx.db
                .insert(schema.groupMembership)
                .values({ userId: user.id, groupSlug: SLUG, role: "member" });

            await runMigration(ctx.db);

            expect(await stubExists(ctx.db)).toBe(false);
            const left = await ctx.db
                .select({ userId: schema.groupMembership.userId })
                .from(schema.groupMembership)
                .where(eq(schema.groupMembership.groupSlug, SLUG));
            expect(left).toEqual([]);
        },
    );

    integrationTest(
        "lar gruppa stå dersom noen har rukket å knytte bøter til den",
        async ({ ctx }) => {
            await seedStub(ctx.db);
            const user = await ctx.utils.createTestUser();
            await ctx.db
                .insert(schema.groupMembership)
                .values({ userId: user.id, groupSlug: SLUG, role: "member" });
            await ctx.db.insert(schema.fine).values({
                groupSlug: SLUG,
                userId: user.id,
                createdByUserId: user.id,
                amount: 1,
                reason: "Bot som ikke skal forsvinne i en migrasjon",
            });

            await runMigration(ctx.db);

            // Både gruppa og medlemskapet står: vakten gjelder begge stegene,
            // så en halvveis sletting er ikke mulig.
            expect(await stubExists(ctx.db)).toBe(true);
            const fines = await ctx.db
                .select({ id: schema.fine.id })
                .from(schema.fine)
                .where(eq(schema.fine.groupSlug, SLUG));
            expect(fines).toHaveLength(1);
        },
    );

    integrationTest(
        "lar gruppa stå dersom den er med i en prioriteringspulje",
        async ({ ctx }) => {
            await seedStub(ctx.db);
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent();
            // Puljen peker på gruppa gjennom sin egen `group_slug`-kolonne.
            // Den er lett å overse ved siden av koblingstabellen
            // event_priority_pool_group, og begge må være med i vakten:
            // fremmednøkkelen er ON DELETE CASCADE, så en oversett pulje ville
            // forsvunnet med gruppa og stille endret hvem som har prioritet.
            await ctx.db
                .insert(schema.eventPriorityPool)
                .values({ eventId: event.id, groupSlug: SLUG });

            await runMigration(ctx.db);

            expect(await stubExists(ctx.db)).toBe(true);
        },
    );

    integrationTest("er en no-op der stubben ikke finnes", async ({ ctx }) => {
        await expect(runMigration(ctx.db)).resolves.toBeUndefined();
        expect(await stubExists(ctx.db)).toBe(false);
    });
});
