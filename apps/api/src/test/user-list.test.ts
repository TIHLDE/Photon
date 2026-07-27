import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("user list", () => {
    integrationTest(
        "lists users with study/cohort projection and filters",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:view"]);
            const client = await ctx.utils.clientForUser(admin);

            // Study and cohort are read off ordinary groups, and Lepton stored
            // the type in uppercase — so cover that spelling here.
            const study = await ctx.utils.createTestGroup({
                slug: "list-study",
                name: "Listeingeniør",
                type: "STUDY",
            });
            const cohort = await ctx.utils.createTestGroup({
                slug: "list-2023",
                name: "2023",
                type: "STUDYYEAR",
            });

            const studying = await ctx.auth.api.createUser({
                body: {
                    email: "listme@test.com",
                    name: "Lise Listetest",
                    password: "test123!",
                    data: { username: "liselist" },
                },
            });
            await ctx.db.insert(schema.groupMembership).values([
                {
                    userId: studying.user.id,
                    groupSlug: study.slug,
                    role: "member",
                },
                {
                    userId: studying.user.id,
                    groupSlug: cohort.slug,
                    role: "member",
                },
            ]);

            const all = await client.api.user.$get({ query: {} });
            expect(all.status).toBe(200);
            const allBody = await all.json();
            const listed = allBody.items.find((u) => u.id === studying.user.id);
            expect(listed?.studyProgram).toBe("Listeingeniør");
            expect(listed?.studyStartYear).toBe(2023);
            expect(allBody.totalCount).toBeGreaterThanOrEqual(2);

            // Search matches username as well as name.
            const searched = await client.api.user.$get({
                query: { search: "liselist" },
            });
            const searchBody = await searched.json();
            expect(searchBody.items).toHaveLength(1);
            expect(searchBody.items[0]?.id).toBe(studying.user.id);

            // Study filter by slug.
            const byStudy = await client.api.user.$get({
                query: { study: study.slug },
            });
            const studyBody = await byStudy.json();
            expect(studyBody.items.map((u) => u.id)).toEqual([
                studying.user.id,
            ]);

            // The "none" sentinel returns everyone without a study programme,
            // which includes the admin but not the student above.
            const withoutStudy = await client.api.user.$get({
                query: { study: "none" },
            });
            const withoutBody = await withoutStudy.json();
            const withoutIds = withoutBody.items.map((u) => u.id);
            expect(withoutIds).toContain(admin.id);
            expect(withoutIds).not.toContain(studying.user.id);

            // Cohort filter.
            const byYear = await client.api.user.$get({
                query: { studyStartYear: "2023" },
            });
            const yearBody = await byYear.json();
            expect(yearBody.items.map((u) => u.id)).toEqual([studying.user.id]);

            // Without permission → 403
            const plain = await ctx.utils.createTestUser();
            const plainClient = await ctx.utils.clientForUser(plain);
            const forbidden = await plainClient.api.user.$get({ query: {} });
            expect(forbidden.status).toBe(403);
        },
        500_000,
    );
});
