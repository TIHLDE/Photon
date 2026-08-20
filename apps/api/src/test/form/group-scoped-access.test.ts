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

            const group = await ctx.utils.createTestGroup();
            const otherGroup = await ctx.utils.createTestGroup();

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
});
