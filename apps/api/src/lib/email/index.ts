import { render } from "@react-email/render";
import nodemailer, { type Transporter } from "nodemailer";
import type { ReactElement } from "react";
import type { AppContext } from "../ctx";
import { env } from "../env";
import { EMAIL_QUEUE_NAME } from "./config";

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
 * Send an email directly
 * @param options Email options (to, subject, component)
 * @param ctx Optional AppContext - if not provided, creates a temporary transporter
 * @deprecated Use enqueueEmail instead for queued sending
 */
export async function sendEmail(
    { to, subject, component }: SendEmailOptions,
    ctx?: AppContext,
) {
    const html = await render(component);

    // Use mailer from context if available, otherwise create temporary one
    const mailer = ctx?.mailer;

    if (!mailer) {
        console.log("-----");
        console.log("📧 [Test Mode] Email not sent:");
        console.log("To:", to);
        console.log("Subject:", subject);
        console.log("HTML:", html);
        console.log("-----");
        return;
    }

    await mailer.sendMail({
        from: `<TIHLDE> ${env.MAIL_FROM}`,
        to,
        subject,
        html,
    });
}

/**
 * Enqueue an email to be sent via BullMQ
 * Emails are sent at a rate of one every 3 seconds
 */
export async function enqueueEmail(
    { to, subject, component }: SendEmailOptions,
    ctx: Pick<AppContext, "queue">,
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
