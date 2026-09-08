import { currentAcademicYear } from "@photon/auth/feide";
import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Klassetrinnet på de admin-listene som før regnet det ut selv.
 *
 * De tre rutene her bar bare `studyStartYear`, og kvark gjorde om det til et
 * klassetrinn i nettleseren. Kullåret alene kan ikke svare: masterens første
 * år er 4. klasse, og om årstallet hører til masteren eller bacheloren foran
 * den står ikke i tallet. Alle 37 masterstudentene i prod sto derfor tre trinn
 * for lavt i brukeroversikten og på påmeldingslistene, mens profilen og
 * svarlista — som spør serveren — hadde dem riktig.
 */
describe("Klassetrinn i admin-listene", () => {
    integrationTest(
        "gir masterstudenten 4. klasse, ikke masteropptaket regnet som kull",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:view"]);
            const master = await ctx.utils.createTestUser();

            await ctx.utils.setupGroups();

            // Bacheloren først, så masteren: den vanlige veien gjennom TIHLDE,
            // og den eneste formen der de to årstallene kan komme i utakt.
            const masterIntake = currentAcademicYear();
            const bachelorIntake = masterIntake - 3;

            await ctx.db.insert(schema.groupMembership).values([
                { userId: master.id, groupSlug: "index", role: "member" },
                {
                    userId: master.id,
                    groupSlug: "digital-forretningsutvikling",
                    role: "member",
                },
                {
                    userId: master.id,
                    groupSlug: "digital-samhandling",
                    role: "member",
                },
                {
                    userId: master.id,
                    groupSlug: String(bachelorIntake),
                    role: "member",
                },
            ]);

            const programmes = await ctx.db
                .insert(schema.studyProgram)
                .values([
                    {
                        slug: "digital-forretningsutvikling",
                        feideCode: "ITBAITBEDR",
                        displayName: "Digital forretningsutvikling",
                        type: "bachelor",
                    },
                    {
                        slug: "digital-samhandling",
                        feideCode: "ITMAIKTSA",
                        displayName: "Digital transformasjon",
                        type: "master",
                    },
                ])
                .returning({
                    id: schema.studyProgram.id,
                    slug: schema.studyProgram.slug,
                });

            const idOf = (slug: string) =>
                programmes.find((p) => p.slug === slug)!.id;

            await ctx.db.insert(schema.studyProgramMembership).values([
                {
                    userId: master.id,
                    studyProgramId: idOf("digital-forretningsutvikling"),
                    startYear: bachelorIntake,
                    startYearSource: "feide",
                    feideActive: false,
                },
                {
                    userId: master.id,
                    studyProgramId: idOf("digital-samhandling"),
                    startYear: masterIntake,
                    startYearSource: "derived",
                    feideActive: true,
                },
            ]);

            const client = await ctx.utils.clientForUser(admin);

            const usersResponse = await client.api.user.$get({ query: {} });
            expect(usersResponse.status).toBe(200);
            const users = await usersResponse.json();
            const listed = users.items.find((item) => item.id === master.id);
            expect(listed).toMatchObject({
                studyProgram: "Digital transformasjon",
                // Kullåret er masteropptaket. Klassetrinnet er ikke 1.
                studyStartYear: masterIntake,
                classYear: 4,
                isAlumni: false,
            });

            const membersResponse = await client.api.groups[
                ":groupSlug"
            ].members.$get({ param: { groupSlug: "index" } });
            expect(membersResponse.status).toBe(200);
            const members = await membersResponse.json();
            const member = members.find((m) => m.user.id === master.id);
            expect(member?.user).toMatchObject({
                studyStartYear: masterIntake,
                classYear: 4,
                isAlumni: false,
            });
        },
    );
});
