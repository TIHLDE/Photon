import { toPlainText } from "@photon/email";
import {
    type EmailTemplateName,
    type EmailTemplateOptions,
    renderEmailTemplate,
} from "@photon/email/templates";
import type { Attachment } from "nodemailer/lib/mailer";
import { env } from "../../env";

export type SendOptions = {
    from: string;
    to: string | string[];
    subject: string;

    cc?: string | string[];
    bcc?: string | string[];
    attachments?: Attachment[];
};

export type ContentOptions =
    | {
          type: "text";
          text: string;
      }
    | {
          type: "html";
          text?: string;
          html: string;
      };

export interface EmailService {
    sendRawEmail(options: SendOptions, content: ContentOptions): Promise<void>;
    sendEmail(options: SendOptions, content: ContentOptions): Promise<void>;

    sendEmailTemplate<TName extends EmailTemplateName>(
        options: SendOptions,
        templateName: TName,
        templateProps: EmailTemplateOptions<TName>,
    ): Promise<void>;

    sendPasswordResetMail(options: { to: string; url: string }): Promise<void>;
    sendVerifyEmailMail(options: { to: string; url: string }): Promise<void>;
}

export abstract class BaseEmailService implements EmailService {
    abstract sendRawEmail(
        options: SendOptions,
        content: ContentOptions,
    ): Promise<void>;

    async sendEmail(options: SendOptions, content: ContentOptions) {
        let finalContent = content;
        if (finalContent.type == "html" && finalContent.text == null) {
            finalContent.text = toPlainText(finalContent.html);
        }
        return await this.sendRawEmail(options, finalContent);
    }

    async sendEmailTemplate<TName extends EmailTemplateName>(
        options: SendOptions,
        templateName: TName,
        templateProps: EmailTemplateOptions<TName>,
    ): Promise<void> {
        const renderedHtml = await renderEmailTemplate(
            templateName,
            templateProps,
        );
        await this.sendEmail(options, {
            type: "html",
            html: renderedHtml,
        });
    }

    async sendPasswordResetMail(options: { to: string; url: string }) {
        await this.sendEmailTemplate(
            {
                from: env.MAIL_FROM,
                to: options.to,
                subject: "Tilbakestill passord",
            },
            "ResetPasswordEmail",
            {
                url: options.url,
                logoUrl: `${env.WEBSITE_URL}/logo512.png`,
            },
        );
    }

    async sendVerifyEmailMail(options: { to: string; url: string }) {
        await this.sendEmailTemplate(
            {
                from: env.MAIL_FROM,
                to: options.to,
                subject: "Bekreft e-postadresse",
            },
            "ChangeEmailVerificationEmail",
            {
                url: options.url,
                logoUrl: `${env.WEBSITE_URL}/logo512.png`,
            },
        );
    }
}
