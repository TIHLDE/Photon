import type { Job, Worker } from "bullmq";
import type { AppContext } from "../ctx";
import { env } from "../env";
import { EMAIL_QUEUE_NAME, EMAIL_SEND_RATE_MS } from "./config";
import type { EmailJobData } from "./index";

/**
 * Create the email processor function with access to ctx
 */
function createEmailProcessor(ctx: AppContext) {
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
export function startEmailWorker(ctx: AppContext): Worker<EmailJobData, void> {
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

    worker.on("completed", (job, returnvalue) => {
        console.log(`✅ Email job ${job.id} completed`, returnvalue);
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
