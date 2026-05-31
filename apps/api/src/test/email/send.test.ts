import type { EmailQueueJobData } from "@photon/core/services/email";
import { EMAIL_QUEUE_NAME } from "@photon/core/services/queue";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("send email endpoint", () => {
    integrationTest(
        "Test sending email to a single recipient",
        async ({ ctx }) => {
            const client = ctx.utils.client({
                Authorization: "Bearer test-email-api-key",
            });

            // Send email to single recipient
            const response = await client.api.email.send.$post({
                json: {
                    to: "test@example.com",
                    subject: "Test Email",
                    content: [
                        {
                            type: "title",
                            content: "Welcome!",
                        },
                        {
                            type: "text",
                            content: "This is a test email.",
                        },
                    ],
                },
            });

            const json = await response.json();

            // Verify response
            expect(response.status).toBe(200);
            expect(json).toMatchObject({
                success: true,
                message: "Email queued successfully",
                recipientCount: 1,
            });

            // Verify Redis queue has the job
            const emailQueue =
                ctx.queue.getQueue<EmailQueueJobData>(EMAIL_QUEUE_NAME);
            const jobs = await emailQueue.getJobs(["waiting", "active"]);

            expect(jobs).toHaveLength(1);
            expect(jobs[0]?.data).toMatchObject({
                options: {
                    to: "test@example.com",
                    subject: "Test Email",
                },
            });
            const content = jobs[0]?.data.content;
            expect(content?.type).toBe("html");
            if (!content || content.type !== "html") {
                throw new Error("Expected queued email content to be HTML");
            }
            expect(content.html).toContain("Welcome!");
            expect(content.html).toContain("This is a test email.");
        },
        500_000,
    );

    integrationTest(
        "Test sending email to multiple recipients",
        async ({ ctx }) => {
            const client = ctx.utils.client({
                Authorization: "Bearer test-email-api-key",
            });

            const recipients = [
                "user1@example.com",
                "user2@example.com",
                "user3@example.com",
            ];

            // Send email to multiple recipients
            const response = await client.api.email.send.$post({
                json: {
                    to: recipients,
                    subject: "Multi-Recipient Test",
                    content: [
                        {
                            type: "title",
                            content: "Announcement",
                        },
                        {
                            type: "text",
                            content:
                                "This email is sent to multiple recipients.",
                        },
                        {
                            type: "button",
                            text: "Click Here",
                            url: "https://example.com",
                        },
                    ],
                },
            });

            const json = await response.json();

            // Verify response
            expect(response.status).toBe(200);
            expect(json).toMatchObject({
                success: true,
                message: "Emails queued successfully",
                recipientCount: 3,
            });

            // Verify Redis queue has all the jobs
            const emailQueue =
                ctx.queue.getQueue<EmailQueueJobData>(EMAIL_QUEUE_NAME);
            const jobs = await emailQueue.getJobs(["waiting", "active"]);

            expect(jobs).toHaveLength(3);

            // Verify each job has the correct recipient
            const jobRecipients = jobs
                .map((job) => job?.data.options.to)
                .sort();
            expect(jobRecipients).toEqual(recipients.sort());

            // Verify all jobs have the same subject and content
            for (const job of jobs) {
                expect(job?.data.options.subject).toBe("Multi-Recipient Test");
                const content = job?.data.content;
                expect(content?.type).toBe("html");
                if (!content || content.type !== "html") {
                    throw new Error("Expected queued email content to be HTML");
                }
                expect(content.html).toContain("Announcement");
                expect(content.html).toContain(
                    "This email is sent to multiple recipients.",
                );
                expect(content.html).toContain("Click Here");
                expect(content.html).toContain("https://example.com");
            }
        },
        500_000,
    );

    integrationTest(
        "Test that sending email without API key fails",
        async ({ ctx }) => {
            const client = ctx.utils.client();

            const response = await client.api.email.send.$post({
                json: {
                    to: "test@example.com",
                    subject: "Test Email",
                    content: [
                        {
                            type: "title",
                            content: "Test",
                        },
                    ],
                },
            });

            expect(response.status).toBe(401);
        },
        500_000,
    );

    integrationTest(
        "Test that sending email with invalid API key fails",
        async ({ ctx }) => {
            const client = ctx.utils.client({
                Authorization: "Bearer invalid-key",
            });

            const response = await client.api.email.send.$post({
                json: {
                    to: "test@example.com",
                    subject: "Test Email",
                    content: [
                        {
                            type: "title",
                            content: "Test",
                        },
                    ],
                },
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "Test that sending email with invalid email address fails",
        async ({ ctx }) => {
            const client = ctx.utils.client({
                Authorization: "Bearer test-email-api-key",
            });

            const response = await client.api.email.send.$post({
                json: {
                    to: "not-an-email",
                    subject: "Test Email",
                    content: [
                        {
                            type: "title",
                            content: "Test",
                        },
                    ],
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "Test that sending email with empty recipients array fails",
        async ({ ctx }) => {
            const client = ctx.utils.client({
                Authorization: "Bearer test-email-api-key",
            });

            const response = await client.api.email.send.$post({
                json: {
                    to: [],
                    subject: "Test Email",
                    content: [
                        {
                            type: "title",
                            content: "Test",
                        },
                    ],
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "Test that sending email with invalid authorization header format fails",
        async ({ ctx }) => {
            const client = ctx.utils.client({
                Authorization: "test-email-api-key",
            });

            // Test without "Bearer" prefix
            const response = await client.api.email.send.$post({
                json: {
                    to: "test@example.com",
                    subject: "Test Email",
                    content: [
                        {
                            type: "title",
                            content: "Test",
                        },
                    ],
                },
            });

            expect(response.status).toBe(401);
        },
        500_000,
    );
});
