import {
    DE_ELDSTES_RAAS_SLUG,
    syncDeEldstesRaas,
} from "@photon/auth/de-eldstes-raas";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DbSchema, schema } from "@photon/db";
import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * De Eldstes Raas admits everyone who has sat in Hovedstyret, and asks nothing
 * else: not what they study, not whether they still study. The membership is
 * written on login, from our own history table, so an alumnus signing in with a
 * password gets in exactly like a sitting student would.
 */

const HS = "hs";

/** Hovedstyret itself — the migration creates De Eldstes Raas, not this. */
const seedHs = async (db: NodePgDatabase<DbSchema>) => {
    await db
        .insert(schema.group)
        .values({
            slug: HS,
            name: "Hovedstyret",
            type: "BOARD",
            finesInfo: "",
            finesActivated: false,
        })
        .onConflictDoNothing();
};

/** An ended stint, i.e. what makes someone a *former* member. */
const endStint = async (
    db: NodePgDatabase<DbSchema>,
    userId: string,
    groupSlug: string,
    endedAt = new Date("2025-05-01T12:00:00Z"),
) => {
    await db.insert(schema.groupMembershipHistory).values({
        userId,
        groupSlug,
        role: "member",
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
                eq(schema.groupMembership.groupSlug, DE_ELDSTES_RAAS_SLUG),
            ),
        )
        .limit(1);
    return row ?? null;
};

describe("De Eldstes Raas", () => {
    integrationTest("exists as a private group", async ({ ctx }) => {
        const [group] = await ctx.db
            .select({ name: schema.group.name, type: schema.group.type })
            .from(schema.group)
            .where(eq(schema.group.slug, DE_ELDSTES_RAAS_SLUG))
            .limit(1);

        expect(group?.name).toBe("De Eldstes Raas");
        expect(group?.type.toLowerCase()).toBe("private");
    });

    integrationTest("enrols a former HS member on login", async ({ ctx }) => {
        await seedHs(ctx.db);
        const user = await ctx.utils.createTestUser();
        await endStint(ctx.db, user.id, HS);

        await syncDeEldstesRaas(ctx.db, user.id);

        expect(await membershipOf(ctx.db, user.id)).toEqual({ role: "member" });
    });

    /**
     * The hook that runs the sync hangs off session creation rather than the
     * Feide callback, so that a member who signs in with a password — which is
     * how most alumni get in — is enrolled too. This test signs in for real to
     * prove the wiring, not just the function.
     */
    integrationTest(
        "enrols a former HS member on an ordinary sign-in",
        async ({ ctx }) => {
            await seedHs(ctx.db);
            const user = await ctx.utils.createTestUser();
            await endStint(ctx.db, user.id, HS);

            await ctx.utils.clientForUser(user);

            expect(await membershipOf(ctx.db, user.id)).toEqual({
                role: "member",
            });
        },
    );

    integrationTest(
        "enrols them whether or not they still study",
        async ({ ctx }) => {
            await seedHs(ctx.db);
            const alumnus = await ctx.utils.createTestUser();
            await endStint(
                ctx.db,
                alumnus.id,
                HS,
                new Date("2014-05-01T12:00:00Z"),
            );

            // No study programme membership at all, which is what an account
            // that finished a decade ago looks like.
            await syncDeEldstesRaas(ctx.db, alumnus.id);

            expect(await membershipOf(ctx.db, alumnus.id)).toEqual({
                role: "member",
            });
        },
    );

    integrationTest(
        "leaves out someone who has never been in HS",
        async ({ ctx }) => {
            await seedHs(ctx.db);
            const user = await ctx.utils.createTestUser();
            const other = await ctx.utils.createTestGroup({
                slug: "raas-other-group",
                type: "COMMITTEE",
            });
            await endStint(ctx.db, user.id, other.slug);

            await syncDeEldstesRaas(ctx.db, user.id);

            expect(await membershipOf(ctx.db, user.id)).toBeNull();
        },
    );

    integrationTest(
        "leaves out a sitting HS member until they step down",
        async ({ ctx }) => {
            await seedHs(ctx.db);
            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: user.id,
                groupSlug: HS,
                role: "member",
            });

            await syncDeEldstesRaas(ctx.db, user.id);
            expect(await membershipOf(ctx.db, user.id)).toBeNull();

            // Stepping down is what appends the history row.
            await ctx.db
                .delete(schema.groupMembership)
                .where(
                    and(
                        eq(schema.groupMembership.userId, user.id),
                        eq(schema.groupMembership.groupSlug, HS),
                    ),
                );
            await endStint(ctx.db, user.id, HS);

            await syncDeEldstesRaas(ctx.db, user.id);
            expect(await membershipOf(ctx.db, user.id)).toEqual({
                role: "member",
            });
        },
    );

    integrationTest(
        "does not demote a member who leads the group",
        async ({ ctx }) => {
            await seedHs(ctx.db);
            const user = await ctx.utils.createTestUser();
            await endStint(ctx.db, user.id, HS);
            await ctx.db.insert(schema.groupMembership).values({
                userId: user.id,
                groupSlug: DE_ELDSTES_RAAS_SLUG,
                role: "leader",
            });

            await syncDeEldstesRaas(ctx.db, user.id);

            expect(await membershipOf(ctx.db, user.id)).toEqual({
                role: "leader",
            });
        },
    );

    integrationTest(
        "stays out once removed by hand, however often they log in",
        async ({ ctx }) => {
            await seedHs(ctx.db);
            const user = await ctx.utils.createTestUser();
            await endStint(ctx.db, user.id, HS);

            await syncDeEldstesRaas(ctx.db, user.id);
            expect(await membershipOf(ctx.db, user.id)).not.toBeNull();

            // What removeUserFromGroup does: delete the row, record the stint.
            await ctx.db
                .delete(schema.groupMembership)
                .where(
                    and(
                        eq(schema.groupMembership.userId, user.id),
                        eq(
                            schema.groupMembership.groupSlug,
                            DE_ELDSTES_RAAS_SLUG,
                        ),
                    ),
                );
            await endStint(
                ctx.db,
                user.id,
                DE_ELDSTES_RAAS_SLUG,
                new Date("2026-08-01T12:00:00Z"),
            );

            await syncDeEldstesRaas(ctx.db, user.id);
            await syncDeEldstesRaas(ctx.db, user.id);

            expect(await membershipOf(ctx.db, user.id)).toBeNull();
        },
    );

    /**
     * The login hook only reaches the people who sign in, so the group is
     * filled once up front by migration 0070. The statement is read from the
     * migration itself rather than restated here: a backfill that has drifted
     * from the one production ran is worth nothing as a test.
     */
    integrationTest(
        "backfills everyone who had already left HS",
        async ({ ctx }) => {
            await seedHs(ctx.db);
            const twoStints = await ctx.utils.createTestUser();
            const oneStint = await ctx.utils.createTestUser();
            const neverInHs = await ctx.utils.createTestUser();

            await endStint(ctx.db, twoStints.id, HS);
            await endStint(
                ctx.db,
                twoStints.id,
                HS,
                new Date("2023-05-01T12:00:00Z"),
            );
            await endStint(ctx.db, oneStint.id, HS);

            const file = await readFile(
                resolve(
                    process.cwd(),
                    "../../packages/db/drizzle/0070_de_eldstes_raas.sql",
                ),
                "utf8",
            );
            const backfill = file.split("--> statement-breakpoint").at(-1);
            await ctx.db.execute(sql.raw(backfill as string));

            expect(await membershipOf(ctx.db, twoStints.id)).toEqual({
                role: "member",
            });
            expect(await membershipOf(ctx.db, oneStint.id)).toEqual({
                role: "member",
            });
            expect(await membershipOf(ctx.db, neverInHs.id)).toBeNull();
        },
    );

    integrationTest(
        "is a no-op where the group does not exist",
        async ({ ctx }) => {
            await seedHs(ctx.db);
            const user = await ctx.utils.createTestUser();
            await endStint(ctx.db, user.id, HS);
            await ctx.db
                .delete(schema.group)
                .where(eq(schema.group.slug, DE_ELDSTES_RAAS_SLUG));

            await expect(
                syncDeEldstesRaas(ctx.db, user.id),
            ).resolves.toBeUndefined();
        },
    );
});
