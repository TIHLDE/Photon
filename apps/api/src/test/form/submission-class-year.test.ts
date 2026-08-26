import { currentAcademicYear } from "@photon/auth/feide";
import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Hva svarlista sier om hvor i løpet den som svarte står.
 *
 * Den skrev kullet, altså året på programraden til det studiet personen går på
 * nå. For en masterstudent er det masteropptaket, mens kullet deres overalt
 * ellers — kullgruppa, klassetrinnet på profilen, prioriteringspoolene — er
 * bacheloråret de begynte. Svarlista sa altså «kull 2026» om den samme
 * personen profilen kalte 4. klasse, og kulldiagrammet talte mastere som
 * førsteklassinger.
 *
 * Nå sendes klassetrinnet, regnet ut med `computeUserClassYear`, som er den
 * samme funksjonen profilen og prioriteringspoolene bruker.
 */
describe("Study on a form submission", () => {
    integrationTest(
        "gives a master student their class year, not the master intake",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const master = await ctx.utils.createTestUser();

            await ctx.utils.setupGroups();
            await ctx.db.insert(schema.groupMembership).values([
                { userId: leader.id, groupSlug: "index", role: "leader" },
                { userId: master.id, groupSlug: "index", role: "member" },
            ]);

            /**
             * Bacheloren først, så masteren: den vanlige veien gjennom TIHLDE,
             * og den eneste formen der de to årstallene kan komme i utakt.
             * Kullgruppa er bachelorens, slik `syncDerivedStudyGroups` lager
             * den — en master eier ingen kullgruppe.
             */
            const masterIntake = currentAcademicYear();
            const bachelorIntake = masterIntake - 3;

            await ctx.db.insert(schema.groupMembership).values([
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

            const leaderClient = await ctx.utils.clientForUser(leader);
            const masterClient = await ctx.utils.clientForUser(master);

            const createResponse = await leaderClient.api.groups[
                ":slug"
            ].forms.$post({
                param: { slug: "index" },
                json: {
                    title: "Påmelding",
                    template: false,
                    group: "index",
                    can_submit_multiple: false,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    fields: [
                        {
                            title: "Hva heter du?",
                            type: "text_answer",
                            required: true,
                            order: 0,
                        },
                    ],
                },
            });
            expect(createResponse.status).toBe(201);
            const form = await createResponse.json();
            const field = form.fields?.[0];
            expect(field).toBeDefined();

            const submitResponse = await masterClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId: form.id! },
                json: {
                    answers: [
                        {
                            field: { id: field?.id as string },
                            answer_text: "Kari",
                        },
                    ],
                },
            });
            expect(submitResponse.status).toBe(201);

            const listResponse = await leaderClient.api.forms[
                ":formId"
            ].submissions.$get({ param: { formId: form.id! } });
            expect(listResponse.status).toBe(200);
            const submissions = await listResponse.json();

            expect(submissions).toHaveLength(1);
            expect(submissions[0]?.user).toMatchObject({
                study_program: "Digital transformasjon",
                // Masterens første år er 4. klasse — ikke masteropptaket,
                // som lista skrev som «kull» før.
                class_year: 4,
            });

            /**
             * De to andre rutene deler `submissionUserSchema`, og fylte det
             * med kullet uten at noe fanget det opp: `c.json` typesjekkes ikke
             * mot skjemaet, så kontrakten kunne love ett felt mens svaret bar
             * et annet.
             */
            const mineResponse = await masterClient.api.forms[
                ":formId"
            ].submissions.me.$get({ param: { formId: form.id! } });
            expect(mineResponse.status).toBe(200);
            const mine = await mineResponse.json();
            expect(mine[0]?.user).toMatchObject({ class_year: 4 });

            const oneResponse = await leaderClient.api.forms[
                ":formId"
            ].submissions[":id"].$get({
                param: { formId: form.id!, id: submissions[0]?.id as string },
            });
            expect(oneResponse.status).toBe(200);
            const one = await oneResponse.json();
            expect(one.user).toMatchObject({ class_year: 4 });
        },
    );
});
