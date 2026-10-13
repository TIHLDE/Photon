import type { EmailQueueJobData } from "@photon/core/services/email";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { EMAIL_QUEUE_NAME } from "@photon/core/services/queue";
import { pino } from "pino";
import { describe, expect, vi } from "vitest";
import { logger as rootLogger, serializeError } from "~/lib/logger";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

async function queuedEmails(ctx: IntegrationTestContext) {
    const emailQueue = ctx.queue.getQueue<EmailQueueJobData>(EMAIL_QUEUE_NAME);
    return emailQueue.getJobs(["waiting", "active"]);
}

describe("Overhört", () => {
    integrationTest(
        "A member's submission is emailed to the editor",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.toddel.overhort.$post({
                json: {
                    name: "Ola Nordmann",
                    statement: "Jeg har aldri tapt i Kahoot.",
                },
            });

            expect(response.status).toBe(200);

            const jobs = await queuedEmails(ctx);
            expect(jobs).toHaveLength(1);
            expect(jobs[0]?.data.options).toMatchObject({
                to: "redaktor@tihlde.org",
                subject: "Overhört: ny innsending",
            });
            expect(jobs[0]?.data.options.replyTo).toBeUndefined();

            const content = jobs[0]?.data.content;
            if (!content || content.type !== "html") {
                throw new Error("Expected queued email content to be HTML");
            }
            expect(content.html).toContain("Ola Nordmann");
            expect(content.html).toContain("Jeg har aldri tapt i Kahoot.");
        },
        500_000,
    );

    integrationTest(
        "Logged-out visitors are turned away",
        async ({ ctx }) => {
            const client = ctx.utils.client();

            const response = await client.api.toddel.overhort.$post({
                json: { name: "Ola Nordmann", statement: "Sitat" },
            });

            expect(response.status).toBe(401);
            expect(await queuedEmails(ctx)).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "Accounts waiting for approval are turned away",
        async ({ ctx }) => {
            const pending = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.user)
                .set({ approvalStatus: "pending" })
                .where(eq(schema.user.id, pending.id));
            const client = await ctx.utils.clientForUser(pending);

            const response = await client.api.toddel.overhort.$post({
                json: { name: "Ola Nordmann", statement: "Sitat" },
            });

            expect(response.status).toBe(403);
            expect(await queuedEmails(ctx)).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "Both fields are required",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.toddel.overhort.$post({
                json: { name: "", statement: "   " },
            });

            expect(response.status).toBe(400);
            expect(await queuedEmails(ctx)).toHaveLength(0);
        },
        500_000,
    );
});
