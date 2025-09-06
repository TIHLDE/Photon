import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { env } from "../env";

console.log(env);

const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
});

type SendEmailOptions = {
    to: string;
    subject: string;
    component: ReactElement;
};

export async function sendEmail({ to, subject, component }: SendEmailOptions) {
    if (!env.SMTP_HOST) {
        console.warn("SMTP env variables not set. Skipping email sending.");
        return;
    }
    const html = await render(component);
    await transporter.sendMail({
        from: `<TIHLDE> ${env.SMTP_FROM}`,
        to,
        subject,
        html,
    });
}
