import { schema } from "@photon/db";
import { eq, sql } from "drizzle-orm";
import { describe, expect } from "vitest";
import { removeUserFromGroup } from "~/lib/group";
import {
    integrationTest,
    type IntegrationTestContext,
} from "~/test/config/integration";

async function setup(ctx: IntegrationTestContext) {
    const user = await ctx.utils.createTestUser();
    const other = await ctx.utils.createTestUser();
    const group = await ctx.utils.createTestGroup({ finesActivated: true });
    await ctx.db.insert(schema.groupMembership).values([
        { userId: user.id, groupSlug: group.slug },
        { userId: other.id, groupSlug: group.slug },
    ]);
    const client = await ctx.utils.clientForUser(user);
    const rows = Array.from({ length: 61 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        groupSlug: group.slug,
        userId: index % 2 === 0 ? user.id : other.id,
        createdByUserId: other.id,
        reason: `Fine ${index}`,
        amount: 0,
        status: index % 2 === 0 ? ("pending" as const) : ("paid" as const),
        // Equal timestamps exercise the deterministic UUID tiebreaker.
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
    }));
    await ctx.db.insert(schema.fine).values(rows);
    return { user, other, group, client, rows };
}

describe("jump to a fine's page", () => {
    integrationTest.for([
        "pending",
        "approved",
        "paid",
        "rejected",
        "active",
    ] as const)(
        "finds a recipient's fine within the %s filter",
        async (status, { ctx }) => {
            const { user, other, group, client, rows } = await setup(ctx);
            const target = rows[20]!;
            await ctx.db
                .update(schema.fine)
                .set({ status: status === "active" ? "approved" : status })
                .where(eq(schema.fine.id, target.id));
            const response = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: {
                    aroundFineId: target.id,
                    userId: user.id,
                    status,
                    pageSize: "10",
                    page: "99",
                },
            });
            expect(response.status).toBe(200);
            const page = await response.json();
            expect(page.page).toBe(
                status === "pending" || status === "active" ? 2 : 0,
            );
            expect(page.totalCount).toBe(
                status === "pending" || status === "active" ? 31 : 1,
            );
            expect(
                page.fines.filter((fine) => fine.id === target.id),
            ).toHaveLength(1);
            expect(
                page.fines.every(
                    (fine) =>
                        fine.userId === user.id &&
                        (status === "active"
                            ? ["pending", "approved"].includes(fine.status)
                            : fine.status === status),
                ),
            ).toBe(true);
            const wrongRecipient = await client.api.groups[
                ":groupSlug"
            ].fines.$get({
                param: { groupSlug: group.slug },
                query: {
                    aroundFineId: target.id,
                    userId: other.id,
                    status,
                    pageSize: "10",
                    page: "99",
                },
            });
            const ordinary = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: { userId: other.id, status, pageSize: "10" },
            });
            expect(wrongRecipient.status).toBe(200);
            expect(await wrongRecipient.json()).toEqual(await ordinary.json());
        },
    );

    integrationTest.for(["paid", "rejected"] as const)(
        "the active filter hides a %s target even when the recipient matches",
        async (status, { ctx }) => {
            const { user, group, client, rows } = await setup(ctx);
            const target = rows[20]!;
            await ctx.db
                .update(schema.fine)
                .set({ status })
                .where(eq(schema.fine.id, target.id));
            const response = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: {
                    aroundFineId: target.id,
                    userId: user.id,
                    status: "active",
                },
            });
            const ordinary = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: { userId: user.id, status: "active" },
            });
            expect(response.status).toBe(200);
            expect(await response.json()).toEqual(await ordinary.json());
        },
    );

    integrationTest(
        "finds an old fine and supports both adjacent pages without duplicates",
        async ({ ctx }) => {
            const { group, client, rows } = await setup(ctx);
            // PostgreSQL's default timestamps can have microseconds, which
            // are lost if the position lookup round-trips through JS Date.
            await ctx.db
                .update(schema.fine)
                .set({
                    createdAt: sql`${schema.fine.createdAt} + interval '1 microsecond'`,
                })
                .where(eq(schema.fine.groupSlug, group.slug));
            const target = rows[20]!;
            const response = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: { pageSize: "25", aroundFineId: target.id },
            });
            expect(response.status).toBe(200);
            const page = await response.json();
            expect(page.page).toBe(1);
            expect(page.pages).toBe(3);
            expect(page.nextPage).toBe(2);
            expect(page.fines).toHaveLength(25);
            expect(page.fines.some((fine) => fine.id === target.id)).toBe(true);

            const newer = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: { pageSize: "25", page: "0" },
            });
            const older = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: { pageSize: "25", page: "2" },
            });
            const ids = [
                ...(await newer.json()).fines,
                ...page.fines,
                ...(await older.json()).fines,
            ].map((fine) => fine.id);
            expect(ids).toEqual(rows.map((row) => row.id).reverse());
            expect(new Set(ids).size).toBe(61);
        },
    );

    integrationTest(
        "locates within filters and falls back for filtered-out, wrong-group or missing targets",
        async ({ ctx }) => {
            const { user, group, client, rows } = await setup(ctx);
            const target = rows[0]!;
            const filtered = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: {
                    pageSize: "25",
                    aroundFineId: target.id,
                    userId: user.id,
                    status: "pending",
                },
            });
            const page = await filtered.json();
            expect(filtered.status).toBe(200);
            expect(page.totalCount).toBe(31);
            expect(page.page).toBe(1);
            expect(page.nextPage).toBeNull();
            expect(page.fines).toHaveLength(6);
            expect(page.fines.at(-1)?.id).toBe(target.id);

            const excluded = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: {
                    aroundFineId: target.id,
                    status: "paid",
                    pageSize: "25",
                },
            });
            expect(excluded.status).toBe(200);
            const excludedPage = await excluded.json();
            expect(excludedPage.page).toBe(0);
            expect(excludedPage.fines).toHaveLength(25);
            expect(
                excludedPage.fines.every((fine) => fine.status === "paid"),
            ).toBe(true);

            const otherGroup = await ctx.utils.createTestGroup({
                slug: "other-fine-group",
                finesActivated: true,
            });
            await ctx.db
                .insert(schema.groupMembership)
                .values({ userId: user.id, groupSlug: otherGroup.slug });
            const wrongGroup = await client.api.groups[":groupSlug"].fines.$get(
                {
                    param: { groupSlug: otherGroup.slug },
                    query: { aroundFineId: target.id },
                },
            );
            expect(wrongGroup.status).toBe(200);
            expect((await wrongGroup.json()).fines).toEqual([]);
            await ctx.db
                .delete(schema.fine)
                .where(eq(schema.fine.id, target.id));
            const deleted = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: { aroundFineId: target.id },
            });
            const ordinary = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: {},
            });
            const firstPage = await ordinary.json();
            expect(deleted.status).toBe(200);
            expect(await deleted.json()).toEqual(firstPage);
            const missing = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: { aroundFineId: crypto.randomUUID() },
            });
            expect(missing.status).toBe(200);
            expect(await missing.json()).toEqual(firstPage);
        },
    );

    integrationTest(
        "limits former members to their own record and refuses outsiders",
        async ({ ctx }) => {
            const { user, other, group, client, rows } = await setup(ctx);
            await ctx.db
                .update(schema.fine)
                .set({ createdByUserId: user.id })
                .where(eq(schema.fine.id, rows[3]!.id));
            await removeUserFromGroup(ctx, user.id, group.slug);
            const own = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: {
                    pageSize: "25",
                    aroundFineId: rows[0]!.id,
                    userId: user.id,
                },
            });
            const page = await own.json();
            expect(own.status).toBe(200);
            expect(page.page).toBe(1);
            expect(page.totalCount).toBe(31);
            expect(page.fines.every((fine) => fine.userId === user.id)).toBe(
                true,
            );
            const hidden = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: {
                    aroundFineId: rows[1]!.id,
                    userId: other.id,
                    status: "paid",
                },
            });
            expect(hidden.status).toBe(200);
            const hiddenPage = await hidden.json();
            expect(hiddenPage.page).toBe(0);
            // Only the fine they gave is visible, never the requested fine.
            expect(hiddenPage.fines.map((fine) => fine.id)).toEqual([
                rows[3]!.id,
            ]);

            const given = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: {
                    aroundFineId: rows[3]!.id,
                    userId: other.id,
                    status: "paid",
                },
            });
            expect(given.status).toBe(200);
            expect((await given.json()).fines.map((fine) => fine.id)).toEqual([
                rows[3]!.id,
            ]);

            const stranger = await ctx.utils.createTestUser();
            const outsider = await ctx.utils.clientForUser(stranger);
            const forbidden = await outsider.api.groups[
                ":groupSlug"
            ].fines.$get({
                param: { groupSlug: group.slug },
                query: { aroundFineId: rows[0]!.id },
            });
            expect(forbidden.status).toBe(403);
            expect(await forbidden.json()).not.toHaveProperty("fines");
        },
    );

    integrationTest(
        "a membership in another group does not authorize a fine link",
        async ({ ctx }) => {
            const { group, rows } = await setup(ctx);
            const stranger = await ctx.utils.createTestUser();
            const otherGroup = await ctx.utils.createTestGroup({
                finesActivated: true,
            });
            await ctx.db
                .insert(schema.groupMembership)
                .values({ userId: stranger.id, groupSlug: otherGroup.slug });
            const client = await ctx.utils.clientForUser(stranger);
            const response = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: {
                    aroundFineId: rows[0]!.id,
                    userId: rows[0]!.userId,
                    status: "pending",
                },
            });
            expect(response.status).toBe(403);
            expect(await response.json()).not.toHaveProperty("fines");
        },
    );

    integrationTest(
        "does not serve fine links without authentication or with fines disabled",
        async ({ ctx }) => {
            const { group, client, rows } = await setup(ctx);
            const anonymous = await ctx.utils
                .client()
                .api.groups[":groupSlug"].fines.$get({
                    param: { groupSlug: group.slug },
                    query: { aroundFineId: rows[0]!.id },
                });
            expect(anonymous.status).toBe(401);
            expect(await anonymous.json()).not.toHaveProperty("fines");
            await ctx.db
                .update(schema.group)
                .set({ finesActivated: false })
                .where(eq(schema.group.slug, group.slug));
            const disabled = await client.api.groups[":groupSlug"].fines.$get({
                param: { groupSlug: group.slug },
                query: { aroundFineId: rows[0]!.id },
            });
            expect(disabled.status).toBe(404);
            expect(await disabled.json()).not.toHaveProperty("fines");
        },
    );
});
