import type { EmailQueueJobData } from "@photon/core/services/email";
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
        "An anonymous submission is emailed to the editor",
        async ({ ctx }) => {
            const client = ctx.utils.client();

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
        "A logged-in sender leaves no trace in the email or the logs",
        async ({ ctx }) => {
            const sender = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(sender);

            // Tests run the root logger silent, so route every request logger
            // into an in-memory sink to see what would reach Loki.
            const records: string[] = [];
            const sink = pino(
                { serializers: { err: serializeError } },
                {
                    write(line: string) {
                        records.push(line);
                    },
                },
            );
            const childSpy = vi
                .spyOn(rootLogger, "child")
                .mockImplementation((bindings) => sink.child(bindings));

            try {
                const response = await client.api.toddel.overhort.$post({
                    json: {
                        name: "Kari Nordmann",
                        statement: "Det der var ikke meg.",
                    },
                });
                expect(response.status).toBe(200);
            } finally {
                childSpy.mockRestore();
            }

            const jobs = await queuedEmails(ctx);
            expect(jobs).toHaveLength(1);
            expect(jobs[0]?.data.options.replyTo).toBeUndefined();

            const payload = JSON.stringify(jobs[0]?.data);
            expect(payload).not.toContain(sender.id);
            expect(payload).not.toContain(sender.email);
            expect(payload).not.toContain(sender.name);

            // The request was logged, just without anything about the sender.
            expect(records.length).toBeGreaterThan(0);
            const logs = records.join("\n");
            expect(logs).not.toContain(sender.id);
            expect(logs).not.toContain(sender.email);
            expect(logs).not.toContain("userId");
        },
        500_000,
    );

    integrationTest(
        "Stops at 50 submissions an hour, even when they arrive at once",
        async ({ ctx }) => {
            // Two separate clients: the cap is global, not per sender.
            const first = ctx.utils.client();
            const second = ctx.utils.client();

            // All in flight together, so a read-then-write counter would let
            // far more than 50 through.
            const responses = await Promise.all(
                Array.from({ length: 60 }, (_, i) =>
                    (i % 2 === 0 ? first : second).api.toddel.overhort.$post({
                        json: { name: `Nummer ${i}`, statement: "Sitat" },
                    }),
                ),
            );
            // 429 comes from a thrown HTTPException, so the typed client doesn't
            // list it among the route's statuses.
            const statuses: number[] = responses.map(
                (response) => response.status,
            );

            expect(statuses.filter((status) => status === 200)).toHaveLength(
                50,
            );
            expect(statuses.filter((status) => status === 429)).toHaveLength(
                10,
            );
            expect(await queuedEmails(ctx)).toHaveLength(50);
        },
        500_000,
    );

    integrationTest(
        "Both fields are required",
        async ({ ctx }) => {
            const client = ctx.utils.client();

            const response = await client.api.toddel.overhort.$post({
                json: { name: "", statement: "   " },
            });

            expect(response.status).toBe(400);
            expect(await queuedEmails(ctx)).toHaveLength(0);
        },
        500_000,
    );
});
