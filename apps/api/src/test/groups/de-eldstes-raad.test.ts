import {
    DE_ELDSTES_RAAD_SLUG,
    syncDeEldstesRaad,
} from "@photon/auth/de-eldstes-raad";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DbSchema, schema } from "@photon/db";
import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * De Eldstes Raad admits those who have carried a position of trust: anyone in
 * Hovedstyret, sitting or former, and whoever leads Forvaltningsgruppen (the
 * fondsforvalter). Ridderne are added by hand — TIHLDE records knighthoods
 * nowhere — so the tests that matter for them are the ones proving nothing in
 * here ever removes anybody.
 *
 * Neither claim asks what the member studies, or whether they still do.
 */

const HS = "hs";
const FORVALTNING = "forvaltningsgruppen";

const seedGroups = async (db: NodePgDatabase<DbSchema>) => {
    await db
        .insert(schema.group)
        .values([
            {
                slug: HS,
                name: "Hovedstyret",
                type: "BOARD",
                finesInfo: "",
                finesActivated: false,
            },
            {
                slug: FORVALTNING,
                name: "Forvaltningsgruppen",
                type: "BOARD",
                finesInfo: "",
                finesActivated: false,
            },
        ])
        .onConflictDoNothing();
};

const join = async (
    db: NodePgDatabase<DbSchema>,
    userId: string,
    groupSlug: string,
    role: "member" | "leader" = "member",
) => {
    await db
        .insert(schema.groupMembership)
        .values({ userId, groupSlug, role })
        .onConflictDoNothing();
};

/** An ended stint, i.e. what a former officeholder leaves behind. */
const endStint = async (
    db: NodePgDatabase<DbSchema>,
    userId: string,
    groupSlug: string,
    role = "member",
    endedAt = new Date("2025-05-01T12:00:00Z"),
) => {
    await db.insert(schema.groupMembershipHistory).values({
        userId,
        groupSlug,
        role,
        startedAt: new Date("2024-05-01T12:00:00Z"),
        endedAt,
    });
};

const membershipOf = async (db: NodePgDatabase<DbSchema>, userId: string) => {
    const [row] = await db
        .select({ role: schema.groupMembership.role })
        .from(schema.groupMembership)
        .where(
            and(
                eq(schema.groupMembership.userId, userId),
                eq(schema.groupMembership.groupSlug, DE_ELDSTES_RAAD_SLUG),
            ),
        )
        .limit(1);
    return row ?? null;
};

describe("De Eldstes Raad", () => {
    integrationTest("exists as a private group", async ({ ctx }) => {
        const [group] = await ctx.db
            .select({ name: schema.group.name, type: schema.group.type })
            .from(schema.group)
            .where(eq(schema.group.slug, DE_ELDSTES_RAAD_SLUG))
            .limit(1);

        expect(group?.name).toBe("De Eldstes Raad");
        expect(group?.type.toLowerCase()).toBe("private");
    });

    /**
     * The old slug is gone: it was «Raas», and the rename moved the roster
     * across rather than leaving two groups behind.
     */
    integrationTest("has replaced the misspelt group", async ({ ctx }) => {
        const rows = await ctx.db
            .select({ slug: schema.group.slug })
            .from(schema.group)
            .where(eq(schema.group.slug, "de-eldstes-raas"));

        expect(rows).toEqual([]);
    });

    integrationTest(
        "enrols a sitting HS member, not only a former one",
        async ({ ctx }) => {
            await seedGroups(ctx.db);
            const sitting = await ctx.utils.createTestUser();
            const former = await ctx.utils.createTestUser();

            await join(ctx.db, sitting.id, HS);
            await endStint(ctx.db, former.id, HS);

            await syncDeEldstesRaad(ctx.db, sitting.id);
            await syncDeEldstesRaad(ctx.db, former.id);

            expect(await membershipOf(ctx.db, sitting.id)).toEqual({
                role: "member",
            });
            expect(await membershipOf(ctx.db, former.id)).toEqual({
                role: "member",
            });
        },
    );

    integrationTest(
        "enrols the leader of Forvaltningsgruppen but not its members",
        async ({ ctx }) => {
            await seedGroups(ctx.db);
            const forvalter = await ctx.utils.createTestUser();
            const ordinary = await ctx.utils.createTestUser();

            await join(ctx.db, forvalter.id, FORVALTNING, "leader");
            await join(ctx.db, ordinary.id, FORVALTNING, "member");

            await syncDeEldstesRaad(ctx.db, forvalter.id);
            await syncDeEldstesRaad(ctx.db, ordinary.id);

            expect(await membershipOf(ctx.db, forvalter.id)).toEqual({
                role: "member",
            });
            expect(await membershipOf(ctx.db, ordinary.id)).toBeNull();
        },
    );

    integrationTest(
        "keeps a former fondsforvalter who has handed the position on",
        async ({ ctx }) => {
            await seedGroups(ctx.db);
            const previous = await ctx.utils.createTestUser();
            await endStint(ctx.db, previous.id, FORVALTNING, "leader");

            await syncDeEldstesRaad(ctx.db, previous.id);

            expect(await membershipOf(ctx.db, previous.id)).toEqual({
                role: "member",
            });
        },
    );

    integrationTest(
        "leaves out someone who has held neither position",
        async ({ ctx }) => {
            await seedGroups(ctx.db);
            const user = await ctx.utils.createTestUser();
            const other = await ctx.utils.createTestGroup({
                slug: "raad-other-group",
                type: "COMMITTEE",
            });
            await join(ctx.db, user.id, other.slug, "leader");

            await syncDeEldstesRaad(ctx.db, user.id);

            expect(await membershipOf(ctx.db, user.id)).toBeNull();
        },
    );

    /**
     * «Med en gang» — the seat is granted where the position is granted, not
     * at the member's next sign-in.
     */
    integrationTest(
        "enrols the moment someone is added to HS",
        async ({ ctx }) => {
            await seedGroups(ctx.db);
            const user = await ctx.utils.createTestUser();

            const { addUserToGroup } = await import("~/lib/group");
            await addUserToGroup(ctx, user.id, HS, "member");

            expect(await membershipOf(ctx.db, user.id)).toEqual({
                role: "member",
            });
        },
    );

    integrationTest(
        "enrols the moment someone is made leader of Forvaltningsgruppen",
        async ({ ctx }) => {
            await seedGroups(ctx.db);
            const user = await ctx.utils.createTestUser();

            const { addUserToGroup, updateGroupMemberRole } =
                await import("~/lib/group");
            await addUserToGroup(ctx, user.id, FORVALTNING, "member");
            expect(await membershipOf(ctx.db, user.id)).toBeNull();

            await updateGroupMemberRole(ctx, user.id, FORVALTNING, "leader");

            expect(await membershipOf(ctx.db, user.id)).toEqual({
                role: "member",
            });
        },
    );

    integrationTest(
        "enrols a former HS member on an ordinary sign-in",
        async ({ ctx }) => {
            await seedGroups(ctx.db);
            const user = await ctx.utils.createTestUser();
            await endStint(ctx.db, user.id, HS);

            await ctx.utils.clientForUser(user);

            expect(await membershipOf(ctx.db, user.id)).toEqual({
                role: "member",
            });
        },
    );

    integrationTest(
        "does not demote a member who leads the group",
        async ({ ctx }) => {
            await seedGroups(ctx.db);
            const user = await ctx.utils.createTestUser();
            await endStint(ctx.db, user.id, HS);
            await join(ctx.db, user.id, DE_ELDSTES_RAAD_SLUG, "leader");

            await syncDeEldstesRaad(ctx.db, user.id);

            expect(await membershipOf(ctx.db, user.id)).toEqual({
                role: "leader",
            });
        },
    );

    /**
     * The rule that makes the knights workable: nothing in the sync removes
     * anyone, and a hand-made removal is never undone.
     */
    integrationTest(
        "stays out once removed by hand, however often they log in",
        async ({ ctx }) => {
            await seedGroups(ctx.db);
            const user = await ctx.utils.createTestUser();
            await join(ctx.db, user.id, HS);

            await syncDeEldstesRaad(ctx.db, user.id);
            expect(await membershipOf(ctx.db, user.id)).not.toBeNull();

            // What removeUserFromGroup does: delete the row, record the stint.
            await ctx.db
                .delete(schema.groupMembership)
                .where(
                    and(
                        eq(schema.groupMembership.userId, user.id),
                        eq(
                            schema.groupMembership.groupSlug,
                            DE_ELDSTES_RAAD_SLUG,
                        ),
                    ),
                );
            await endStint(
                ctx.db,
                user.id,
                DE_ELDSTES_RAAD_SLUG,
                "member",
                new Date("2026-08-01T12:00:00Z"),
            );

            await syncDeEldstesRaad(ctx.db, user.id);
            await syncDeEldstesRaad(ctx.db, user.id);

            expect(await membershipOf(ctx.db, user.id)).toBeNull();
        },
    );

    /**
     * The backfill is read from the migration itself rather than restated
     * here: one that has drifted from the one production ran is worth nothing
     * as a test.
     */
    integrationTest(
        "backfills sitting HS and the fondsforvalter",
        async ({ ctx }) => {
            await seedGroups(ctx.db);
            const sitting = await ctx.utils.createTestUser();
            const forvalter = await ctx.utils.createTestUser();
            const ordinary = await ctx.utils.createTestUser();
            const formerHs = await ctx.utils.createTestUser();

            await join(ctx.db, sitting.id, HS);
            await join(ctx.db, forvalter.id, FORVALTNING, "leader");
            await join(ctx.db, ordinary.id, FORVALTNING, "member");
            await endStint(ctx.db, formerHs.id, HS);

            const file = await readFile(
                resolve(
                    process.cwd(),
                    "../../packages/db/drizzle/0071_de_eldstes_raad.sql",
                ),
                "utf8",
            );
            // The two backfills are the last two statements; the rename above
            // them has already run as part of the migration.
            for (const statement of file
                .split("--> statement-breakpoint")
                .slice(-2)) {
                await ctx.db.execute(sql.raw(statement));
            }

            expect(await membershipOf(ctx.db, sitting.id)).not.toBeNull();
            expect(await membershipOf(ctx.db, forvalter.id)).not.toBeNull();
            expect(await membershipOf(ctx.db, formerHs.id)).not.toBeNull();
            expect(await membershipOf(ctx.db, ordinary.id)).toBeNull();
        },
    );

    integrationTest(
        "is a no-op where the group does not exist",
        async ({ ctx }) => {
            await seedGroups(ctx.db);
            const user = await ctx.utils.createTestUser();
            await join(ctx.db, user.id, HS);
            await ctx.db
                .delete(schema.group)
                .where(eq(schema.group.slug, DE_ELDSTES_RAAD_SLUG));

            await expect(
                syncDeEldstesRaad(ctx.db, user.id),
            ).resolves.toBeUndefined();
        },
    );
});
