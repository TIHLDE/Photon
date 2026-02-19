import type { Job, Worker } from "bullmq";
import { env } from "@photon/core/env";
import type { QueueManager } from "@photon/core/cache";
import { EMAIL_QUEUE_NAME, EMAIL_SEND_RATE_MS } from "./config";
import type { EmailJobData, EmailTransporter } from "./index";

interface EmailWorkerContext {
    mailer: EmailTransporter;
    queue: QueueManager;
}

/**
 * Create the email processor function with access to ctx
 */
function createEmailProcessor(ctx: EmailWorkerContext) {
    return async (job: Job<EmailJobData>): Promise<void> => {
        const { to, subject, html } = job.data;

        if (!ctx.mailer) {
            console.log("Test mode: skipping email send");
            console.log("To:", to);
            console.log("Subject:", subject);
            return;
        }

        await ctx.mailer.sendMail({
            from: `<TIHLDE> ${env.MAIL_FROM}`,
            to,
            subject,
            html,
        });

        console.log(`📧 Email sent to ${to}: ${subject}`);
    };
}

/**
 * Start the email worker with rate limiting
 * Processes emails at a rate of one every 3 seconds
 */
export function startEmailWorker(
    ctx: EmailWorkerContext,
): Worker<EmailJobData, void> {
    const worker = ctx.queue.createWorker<EmailJobData, void>(
        EMAIL_QUEUE_NAME,
        createEmailProcessor(ctx),
        {
            // Rate limiting: max 1 job per EMAIL_SEND_RATE_MS
            limiter: {
                max: 1,
                duration: EMAIL_SEND_RATE_MS,
            },
        },
    );

    worker.on("completed", (job) => {
        console.log(`✅ Email job ${job.id} completed`);
    });

    worker.on("failed", (job, err) => {
        console.error(`❌ Email job ${job?.id} failed:`, err);
    });

    worker.on("error", (err) => {
        console.error("Email worker error:", err);
    });

    console.log(
        `📧 Email worker started (rate: 1 email per ${EMAIL_SEND_RATE_MS}ms)`,
    );

    return worker;
}
