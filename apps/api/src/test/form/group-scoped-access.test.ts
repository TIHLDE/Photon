import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * "Spørreskjema" handed to a group, rather than to a person org-wide.
 *
 * The checkbox has always been group-scopable, and creating a group's form
 * honoured that — but everything downstream asked for the org-wide grant or
 * for being the group's leader. A group could therefore make a form it could
 * never read the answers to, which is exactly what happened to a group during
 * opptak: the leader handed a member "Spørreskjema", the member made the form,
 * and then nobody but the leader could open the søknader.
 */
describe("group-scoped forms access", () => {
    integrationTest(
        "a member holding the group's «Spørreskjema» can read and manage its form",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const helper = await ctx.utils.createTestUser();
            const outsider = await ctx.utils.createTestUser();

            // Eksplisitte slugs: createTestGroup lager sin egen av
            // Date.now(), og to grupper på rad lander i samme millisekund.
            const group = await ctx.utils.createTestGroup({
                slug: "forms-scope-eier",
            });
            const otherGroup = await ctx.utils.createTestGroup({
                slug: "forms-scope-andre",
            });

            // The group gives every member the forms domain, scoped to itself.
            await ctx.db
                .update(schema.group)
                .set({ memberPermissions: ["forms:create", "forms:manage"] })
                .where(eq(schema.group.slug, group.slug));

            await ctx.db.insert(schema.groupMembership).values([
                { userId: leader.id, groupSlug: group.slug, role: "leader" },
                { userId: helper.id, groupSlug: group.slug, role: "member" },
                {
                    userId: outsider.id,
                    groupSlug: otherGroup.slug,
                    role: "leader",
                },
            ]);

            const helperClient = await ctx.utils.clientForUser(helper);
            const outsiderClient = await ctx.utils.clientForUser(outsider);

            const created = await helperClient.api.groups[":slug"].forms.$post({
                param: { slug: group.slug },
                json: {
                    title: "Opptak",
                    description: "Søknad",
                    template: false,
                    group: group.slug,
                    can_submit_multiple: false,
                    is_open_for_submissions: true,
                    only_for_group_members: false,
                    fields: [
                        {
                            title: "Hvorfor søker du?",
                            type: "text_answer",
                            required: true,
                            order: 0,
                        },
                    ],
                },
            });
            expect(created.status).toBe(201);
            const form = await created.json();
            const formId = form.id!;
            const fieldId = form.fields?.[0]?.id!;

            // Someone applies.
            const applicant = await ctx.utils.createTestUser();
            const applicantClient = await ctx.utils.clientForUser(applicant);
            const submitted = await applicantClient.api.forms[
                ":formId"
            ].submissions.$post({
                param: { formId },
                json: {
                    answers: [
                        {
                            field: { id: fieldId },
                            answer_text: "Fordi jeg vil",
                        },
                    ],
                },
            });
            expect(submitted.status).toBe(201);

            // The whole point: the member who made the form can read the
            // answers to it, without a global grant and without leading.
            const listed = await helperClient.api.forms[
                ":formId"
            ].submissions.$get({ param: { formId } });
            expect(listed.status).toBe(200);
            expect(await listed.json()).toHaveLength(1);

            const stats = await helperClient.api.forms[":id"].statistics.$get({
                param: { id: formId },
            });
            expect(stats.status).toBe(200);

            // …and the grant stops at the group's own forms. The other
            // group's leader holds "Spørreskjema" nowhere near this one.
            const denied = await outsiderClient.api.forms[
                ":formId"
            ].submissions.$get({ param: { formId } });
            expect(denied.status).toBe(403);
        },
        500_000,
    );

    /**
     * Evalueringsskjemaet spurte etter `events:manage` org-vidt, så gruppa som
     * faktisk arrangerte kunne ikke åpne evalueringen av sitt eget
     * arrangement — samme form som feilen over, i arrangementsdomenet.
     */
    integrationTest(
        "the arranging group can open the evaluation of its own event",
        async ({ ctx }) => {
            const arranger = await ctx.utils.createTestUser();
            const outsider = await ctx.utils.createTestUser();

            const group = await ctx.utils.createTestGroup({
                slug: "eval-scope-arrangor",
            });
            const otherGroup = await ctx.utils.createTestGroup({
                slug: "eval-scope-andre",
            });

            // «Arrangementer» for gruppa, scopet til gruppa selv.
            await ctx.db
                .update(schema.group)
                .set({ memberPermissions: ["events:update", "events:manage"] })
                .where(eq(schema.group.slug, group.slug));
            await ctx.db
                .update(schema.group)
                .set({ memberPermissions: ["events:update", "events:manage"] })
                .where(eq(schema.group.slug, otherGroup.slug));

            await ctx.db.insert(schema.groupMembership).values([
                { userId: arranger.id, groupSlug: group.slug, role: "member" },
                {
                    userId: outsider.id,
                    groupSlug: otherGroup.slug,
                    role: "member",
                },
            ]);

            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent({
                organizerGroupSlug: group.slug,
            });

            const arrangerClient = await ctx.utils.clientForUser(arranger);
            const outsiderClient = await ctx.utils.clientForUser(outsider);

            const created = await arrangerClient.api.event[
                ":eventId"
            ].forms.$post({
                param: { eventId: event.id },
                json: {
                    title: "Evaluering",
                    description: "Etter arrangementet",
                    type: "evaluation",
                    event: event.id,
                    template: false,
                    fields: [
                        {
                            title: "Hvordan var det?",
                            type: "text_answer",
                            required: true,
                            order: 0,
                        },
                    ],
                },
            });
            expect(created.status).toBe(201);

            // Arrangøren har aldri deltatt på sitt eget arrangement, så dette
            // er tilgangen — ikke oppmøtet — som åpner skjemaet.
            const opened = await arrangerClient.api.event[":eventId"].forms[
                ":type"
            ].$get({ param: { eventId: event.id, type: "evaluation" } });
            expect(opened.status).toBe(200);

            // Og «Arrangementer» for en annen gruppe når ikke hit.
            const denied = await outsiderClient.api.event[":eventId"].forms[
                ":type"
            ].$get({ param: { eventId: event.id, type: "evaluation" } });
            expect(denied.status).toBe(403);
        },
        500_000,
    );

    /**
     * Samme grant, ett steg tidligere: lista over gruppas skjema filtrerte
     * utelukkende på lederskap og medlemskap, og spurte aldri om tilganger.
     * Et stengt skjema — et opptak som er ferdig, eller ett som ennå ikke har
     * åpnet — var derfor usynlig for alle andre enn lederen, enda den som
     * holder «Spørreskjema» for gruppa slipper inn på selve svarene.
     */
    integrationTest(
        "a scoped «Spørreskjema» grant sees the group's closed forms in the list",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const helper = await ctx.utils.createTestUser();
            const plainMember = await ctx.utils.createTestUser();

            const group = await ctx.utils.createTestGroup({
                slug: "forms-liste-eier",
            });

            await ctx.db.insert(schema.groupMembership).values([
                { userId: leader.id, groupSlug: group.slug, role: "leader" },
                { userId: helper.id, groupSlug: group.slug, role: "member" },
                {
                    userId: plainMember.id,
                    groupSlug: group.slug,
                    role: "member",
                },
            ]);

            // Grantet ligger på personen, ikke på medlemskapet: da skiller
            // testen mellom den som har fått «Spørreskjema» og den som bare
            // er med i gruppa.
            await ctx.db.insert(schema.userPermission).values({
                userId: helper.id,
                permission: "forms:manage",
                scope: `group:${group.slug}`,
            });

            const leaderClient = await ctx.utils.clientForUser(leader);
            const helperClient = await ctx.utils.clientForUser(helper);
            const memberClient = await ctx.utils.clientForUser(plainMember);

            // Et stengt skjema — opptaket er over.
            const created = await leaderClient.api.groups[":slug"].forms.$post({
                param: { slug: group.slug },
                json: {
                    title: "Opptak som er stengt",
                    description: "Ferdig",
                    template: false,
                    group: group.slug,
                    can_submit_multiple: false,
                    is_open_for_submissions: false,
                    only_for_group_members: false,
                    fields: [
                        {
                            title: "Hvorfor søker du?",
                            type: "text_answer",
                            required: true,
                            order: 0,
                        },
                    ],
                },
            });
            expect(created.status).toBe(201);

            const forHelper = await helperClient.api.groups[":slug"].forms.$get(
                { param: { slug: group.slug } },
            );
            expect(forHelper.status).toBe(200);
            expect(await forHelper.json()).toHaveLength(1);

            // Medlemskapet alene rekker fortsatt bare til det som er åpent.
            const forMember = await memberClient.api.groups[":slug"].forms.$get(
                { param: { slug: group.slug } },
            );
            expect(forMember.status).toBe(200);
            expect(await forMember.json()).toHaveLength(0);
        },
        500_000,
    );
});
