import { currentAcademicYear } from "@photon/auth/academic-year";
import { assignUserRole, createTestingRole } from "@photon/auth/roles";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

describe("user list", () => {
    /** The two baseline roles as production seeds them; a test db starts empty. */
    async function seedBaselineRoles(ctx: IntegrationTestContext) {
        await createTestingRole(ctx, {
            name: "member",
            description: "Baseline member role",
            permissions: ["events:registrations:create"],
            position: 2,
        });
        await createTestingRole(ctx, {
            name: "alumni",
            description: "Baseline alumni role",
            permissions: [],
            position: 1,
        });
    }
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

    /**
     * The three states the admin panel used to render as a healthy "Aktiv".
     *
     * An account with no baseline role is the one that cost us: it looks
     * finished from every column in the list and answers 403 to every
     * påmelding. The other two are the same failure one login away — Feide
     * saying the programme is not active is what demotes a member to alumni,
     * and an alumnus the cohort still places in 3. klasse is that demotion
     * having already happened to the wrong person.
     */
    integrationTest(
        "flags the accounts whose state the other columns hide",
        async ({ ctx }) => {
            await seedBaselineRoles(ctx);

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:view"]);
            const client = await ctx.utils.clientForUser(admin);

            await ctx.utils.createTestGroup({
                slug: "flagg-studie",
                name: "Flaggingeniør",
                type: "STUDY",
            });
            const [programme] = await ctx.db
                .insert(schema.studyProgram)
                .values({
                    slug: "flagg-studie",
                    feideCode: "BIDATA",
                    displayName: "Flaggingeniør",
                    type: "bachelor",
                })
                .returning({ id: schema.studyProgram.id });

            /**
             * Kullåret ruller i august, ikke i januar, og klassetrinnet
             * regnes mot det. Kalenderåret ville gitt klassetrinn 0 fra
             * nyttår til august, og da faller `alumni-mismatch` bort.
             */
            const currentYear = currentAcademicYear();

            async function studentWith(
                username: string,
                options: {
                    role?: "member" | "alumni";
                    feideActive: boolean;
                    approvalStatus?: "pending";
                },
            ) {
                const created = await ctx.auth.api.createUser({
                    body: {
                        email: `${username}@test.com`,
                        name: username,
                        password: "test123!",
                        data: { username },
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: created.user.id,
                    groupSlug: "flagg-studie",
                    role: "member",
                });
                await ctx.db.insert(schema.studyProgramMembership).values({
                    userId: created.user.id,
                    studyProgramId: programme?.id as number,
                    // First year, so the cohort places them well inside the
                    // programme however the test happens to be dated.
                    startYear: currentYear,
                    startYearSource: "derived",
                    feideActive: options.feideActive,
                });
                if (options.role) {
                    await assignUserRole(ctx, created.user.id, options.role);
                }
                if (options.approvalStatus) {
                    await ctx.db
                        .update(schema.user)
                        .set({ approvalStatus: options.approvalStatus })
                        .where(eq(schema.user.id, created.user.id));
                }
                return created.user.id;
            }

            const healthy = await studentWith("friskfhs", {
                role: "member",
                feideActive: true,
            });
            const roleless = await studentWith("rollelos", {
                feideActive: true,
            });
            const inactive = await studentWith("inaktivf", {
                role: "member",
                feideActive: false,
            });
            const wronglyAlumni = await studentWith("feilalum", {
                role: "alumni",
                feideActive: true,
            });
            /**
             * Holder ingen rolle, akkurat som `roleless` — men den står i
             * godkjenningskøen, der det å godkjenne er det som deler ut
             * rollen. Ingenting er galt med den, og merket skal bety at noe
             * er det.
             */
            const awaitingApproval = await studentWith("ventern", {
                feideActive: true,
                approvalStatus: "pending",
            });

            const res = await client.api.user.$get({ query: {} });
            expect(res.status).toBe(200);
            const body = await res.json();
            const issuesFor = (id: string) =>
                body.items.find((u) => u.id === id)?.issues;

            expect(issuesFor(healthy)).toEqual([]);
            expect(issuesFor(roleless)).toEqual(["no-baseline-role"]);
            expect(issuesFor(inactive)).toEqual(["feide-inactive"]);
            expect(issuesFor(wronglyAlumni)).toEqual(["alumni-mismatch"]);
            expect(issuesFor(awaitingApproval)).toEqual([]);
        },
    );
});
