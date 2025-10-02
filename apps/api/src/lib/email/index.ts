import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import type { ReactElement } from "react";
import { env } from "../env";

const getTransporter = () => {
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

const transporter = getTransporter();

type SendEmailOptions = {
    to: string;
    subject: string;
    component: ReactElement;
};

export async function sendEmail({ to, subject, component }: SendEmailOptions) {
    const html = await render(component);
    await transporter.sendMail({
        from: `<TIHLDE> ${env.MAIL_FROM}`,
        to,
        subject,
        html,
    });
}
