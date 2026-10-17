import type { EmailQueueJobData } from "@photon/core/services/email";
import { EMAIL_QUEUE_NAME } from "@photon/core/services/queue";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

async function setup(ctx: IntegrationTestContext) {
    await ctx.utils.setupGroups();
    const leader = await ctx.utils.createTestUser();
    const member = await ctx.utils.createTestUser();
    await ctx.db.insert(schema.groupMembership).values([
        { userId: leader.id, groupSlug: "biljard", role: "leader" },
        { userId: member.id, groupSlug: "biljard", role: "member" },
    ]);
    await ctx.db
        .update(schema.group)
        .set({ acceptsJoinRequests: true })
        .where(eq(schema.group.slug, "biljard"));
    return { leader, member };
}

async function queuedEmails(ctx: IntegrationTestContext) {
    return ctx.queue
        .getQueue<EmailQueueJobData>(EMAIL_QUEUE_NAME)
        .getJobs(["waiting", "active"]);
}

describe("Asking to join an interest group", () => {
    integrationTest(
        "Emails the leader once a day",
        async ({ ctx }) => {
            const { leader } = await setup(ctx);
            const applicant = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(applicant);
            const groups = client.api.groups[":slug"];

            const group = await (
                await groups.$get({ param: { slug: "biljard" } })
            ).json();
            expect(group.viewerCanRequestToJoin).toBe(true);

            const sent = await groups["join-request"].$post({
                param: { slug: "biljard" },
            });
            expect(sent.status).toBe(200);

            const emails = await queuedEmails(ctx);
            expect(emails).toHaveLength(1);
            expect(emails[0]?.data.options).toMatchObject({
                to: [leader.email],
                subject: "Ønsker å bli med i TIHLDE Biljard",
            });
            const content = emails[0]?.data.content;
            if (!content || content.type !== "html") {
                throw new Error("Expected queued email content to be HTML");
            }
            expect(content.html).toContain(
                `${applicant.name} vil gjerne bli med i interessegruppen TIHLDE Biljard, gjerne legg dem til som medlem!`,
            );

            const again = await groups["join-request"].$post({
                param: { slug: "biljard" },
            });
            expect(again.status).toBe(429);
            expect(await queuedEmails(ctx)).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "Only signed-in non-members of an open interest group can ask",
        async ({ ctx }) => {
            const { member } = await setup(ctx);
            const outsider = await ctx.utils.createTestUser();

            const cases = [
                [await ctx.utils.clientForUser(outsider), "basket", 400],
                [await ctx.utils.clientForUser(member), "biljard", 409],
                [ctx.utils.client(), "biljard", 401],
            ] as const;
            for (const [client, slug, status] of cases) {
                const groups = client.api.groups[":slug"];
                const group = await (
                    await groups.$get({ param: { slug } })
                ).json();
                expect(group.viewerCanRequestToJoin).toBe(false);

                const response = await groups["join-request"].$post({
                    param: { slug },
                });
                expect(response.status).toBe(status);
            }
            expect(await queuedEmails(ctx)).toHaveLength(0);
        },
        500_000,
    );
});
