import { render } from "@react-email/render";
import nodemailer, { type Transporter } from "nodemailer";
import type { ReactElement } from "react";
import { env } from "@photon/core/env";
import type { QueueManager } from "@photon/core/cache";
import { EMAIL_QUEUE_NAME } from "./config";

export type { ReactElement as EmailComponent } from "react";

export type EmailTransporter = Transporter | undefined;

export const createEmailTransporter = (): EmailTransporter => {
    if (env.NODE_ENV === "test") {
        return;
    }

    if (!env.MAIL_HOST) {
        // Sink
        const transport = nodemailer.createTransport({
            host: "localhost",
            port: 1025,
            secure: false,
        });

        console.log("📧 Serving mail inbox at http://localhost:8025");
        return transport;
    }

    // Actual SMTP
    return nodemailer.createTransport({
        host: env.MAIL_HOST,
        port: env.MAIL_PORT,
        secure: true,
        auth: {
            user: env.MAIL_USER,
            pass: env.MAIL_PASS,
        },
    });
};

type SendEmailOptions = {
    to: string;
    subject: string;
    component: ReactElement;
};

export type EmailJobData = {
    to: string;
    subject: string;
    html: string;
};

/**
 * Enqueue an email to be sent via BullMQ
 * Emails are sent at a rate of one every 3 seconds
 */
export async function enqueueEmail(
    { to, subject, component }: SendEmailOptions,
    ctx: { queue: QueueManager },
) {
    // Pre-render the component to HTML before queuing
    const html = await render(component);

    const emailQueue = ctx.queue.getQueue(EMAIL_QUEUE_NAME);

    const job = await emailQueue.add("send-email", {
        to,
        subject,
        html,
    } satisfies EmailJobData);

    return job;
}
