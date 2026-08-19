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
            // Adressen er med for alle, ikke bare de som venter på godkjenning
            // — den er den eneste veien til et medlem utenfor nettsiden.
            expect(listed?.email).toBe("listme@test.com");
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

    integrationTest(
        "shows the study a member switched to, not the one they left",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:view"]);
            const client = await ctx.utils.clientForUser(admin);

            /**
             * The bug this whole change was reported for. A member took
             * Digital forretningsutvikling from 2023 and went on to the master
             * in 2026, and the list showed the bachelor — because it kept the
             * alphabetically first slug per member, and
             * `digital-forretningsutvikling` sorts before `digital-samhandling`.
             *
             * Note the cohort group: it holds 2023, the year the *bachelor*
             * started. Reading it for the master is the same confusion in the
             * other column, so the year has to follow the programme that wins.
             */
            await ctx.utils.createTestGroup({
                slug: "digital-forretningsutvikling",
                name: "Digital forretningsutvikling",
                type: "STUDY",
            });
            await ctx.utils.createTestGroup({
                slug: "digital-samhandling",
                name: "Digital transformasjon",
                type: "STUDY",
            });
            await ctx.utils.createTestGroup({
                slug: "2023",
                name: "2023",
                type: "STUDYYEAR",
            });

            const [bachelor] = await ctx.db
                .insert(schema.studyProgram)
                .values({
                    slug: "digital-forretningsutvikling",
                    feideCode: "ITBAITBEDR",
                    displayName: "Digital Forretningsutvikling",
                    type: "bachelor",
                })
                .returning({ id: schema.studyProgram.id });
            const [master] = await ctx.db
                .insert(schema.studyProgram)
                .values({
                    slug: "digital-samhandling",
                    feideCode: "ITMAIKTSA",
                    displayName: "Digital Samhandling",
                    type: "master",
                })
                .returning({ id: schema.studyProgram.id });

            const switcher = await ctx.auth.api.createUser({
                body: {
                    email: "byttet@test.com",
                    name: "Bytte Studentsen",
                    password: "test123!",
                    data: { username: "byttet" },
                },
            });

            await ctx.db.insert(schema.groupMembership).values([
                {
                    userId: switcher.user.id,
                    groupSlug: "digital-forretningsutvikling",
                    role: "member",
                },
                {
                    userId: switcher.user.id,
                    groupSlug: "digital-samhandling",
                    role: "member",
                },
                { userId: switcher.user.id, groupSlug: "2023", role: "member" },
            ]);
            await ctx.db.insert(schema.studyProgramMembership).values([
                {
                    userId: switcher.user.id,
                    studyProgramId: bachelor?.id as number,
                    startYear: 2023,
                    startYearSource: "derived",
                    feideActive: false,
                },
                {
                    userId: switcher.user.id,
                    studyProgramId: master?.id as number,
                    startYear: 2026,
                    startYearSource: "derived",
                    feideActive: true,
                },
            ]);

            const res = await client.api.user.$get({ query: {} });
            expect(res.status).toBe(200);
            const body = await res.json();
            const listed = body.items.find((u) => u.id === switcher.user.id);

            expect(listed?.studyProgram).toBe("Digital transformasjon");
            // The master's own intake, not the bachelor cohort group's 2023.
            expect(listed?.studyStartYear).toBe(2026);
        },
    );

    integrationTest(
        "does not read a non-study group as someone's degree",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:view"]);
            const client = await ctx.utils.clientForUser(admin);

            /**
             * `fondsforvalter` carries `type = 'STUDY'` in production without
             * being a study, and the member holding it joined it more recently
             * than their actual degree. Filtering on the group type alone
             * would report it as what they study. See
             * https://github.com/TIHLDE/Photon/issues/621.
             */
            await ctx.utils.createTestGroup({
                slug: "digital-infrastruktur-og-cybersikkerhet",
                name: "Digital infrastruktur og cybersikkerhet",
                type: "STUDY",
            });
            await ctx.utils.createTestGroup({
                slug: "fondsforvalter",
                name: "Fondsforvalter",
                type: "STUDY",
            });
            await ctx.db.insert(schema.studyProgram).values({
                slug: "digital-infrastruktur-og-cybersikkerhet",
                feideCode: "BDIGSEC",
                displayName: "Digital Infrastruktur og Cybersikkerhet",
                type: "bachelor",
            });

            const member = await ctx.auth.api.createUser({
                body: {
                    email: "fond@test.com",
                    name: "Fond Forvaltersen",
                    password: "test123!",
                    data: { username: "fondf" },
                },
            });
            await ctx.db.insert(schema.groupMembership).values([
                {
                    userId: member.user.id,
                    groupSlug: "digital-infrastruktur-og-cybersikkerhet",
                    role: "member",
                },
                {
                    userId: member.user.id,
                    groupSlug: "fondsforvalter",
                    role: "member",
                },
            ]);

            const res = await client.api.user.$get({ query: {} });
            const body = await res.json();
            const listed = body.items.find((u) => u.id === member.user.id);

            expect(listed?.studyProgram).toBe(
                "Digital infrastruktur og cybersikkerhet",
            );
        },
    );
});
