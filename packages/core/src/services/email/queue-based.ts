import {
    BaseEmailService,
    type ContentOptions,
    type EmailService,
    type SendOptions,
} from "./base";
import {
    EMAIL_QUEUE_NAME,
    EMAIL_SEND_RATE_MS,
    type QueueJob,
    type QueueService,
    type WorkerLike,
} from "../queue";

export type EmailQueueJobData = {
    options: SendOptions;
    content: ContentOptions;
};

export class QueuedEmailService extends BaseEmailService {
    constructor(private readonly queue: QueueService) {
        super();
    }

    async sendRawEmail(
        options: SendOptions,
        content: ContentOptions,
    ): Promise<void> {
        await this.queue
            .getQueue<EmailQueueJobData>(EMAIL_QUEUE_NAME)
            .add("send-email", {
                options,
                content,
            });
    }

    /** The whole batch onto the queue in one round trip. */
    override async sendRawEmails(
        emails: Array<{ options: SendOptions; content: ContentOptions }>,
    ): Promise<void> {
        if (emails.length === 0) return;

        await this.queue.getQueue<EmailQueueJobData>(EMAIL_QUEUE_NAME).addBulk(
            emails.map((email) => ({
                name: "send-email",
                data: { options: email.options, content: email.content },
            })),
        );
    }
}

export function startQueuedEmailWorker(
    queue: QueueService,
    emailService: EmailService,
): WorkerLike {
    const worker = queue.createWorker<EmailQueueJobData, void>(
        EMAIL_QUEUE_NAME,
        async (job: QueueJob<EmailQueueJobData>) => {
            await emailService.sendRawEmail(job.data.options, job.data.content);
        },
        {
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

    return worker;
}
