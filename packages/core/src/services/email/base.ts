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
    replyTo?: string;
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

/** One templated email, for the bulk variants below. */
export type TemplatedEmail<
    TName extends EmailTemplateName = EmailTemplateName,
> = {
    options: SendOptions;
    templateName: TName;
    templateProps: EmailTemplateOptions<TName>;
};

export interface EmailService {
    sendRawEmail(options: SendOptions, content: ContentOptions): Promise<void>;
    sendRawEmails(
        emails: Array<{ options: SendOptions; content: ContentOptions }>,
    ): Promise<void>;
    sendEmail(options: SendOptions, content: ContentOptions): Promise<void>;

    sendEmailTemplate<TName extends EmailTemplateName>(
        options: SendOptions,
        templateName: TName,
        templateProps: EmailTemplateOptions<TName>,
    ): Promise<void>;

    /**
     * Hand over a whole batch at once.
     *
     * A caller with one mail per member — the registration resolver, once a
     * sign-up wave is decided — otherwise pays a round trip each to hand them
     * over, one after the other.
     */
    sendEmailTemplates(emails: TemplatedEmail[]): Promise<void>;

    sendPasswordResetMail(options: { to: string; url: string }): Promise<void>;
    sendVerifyEmailMail(options: { to: string; url: string }): Promise<void>;
}

export abstract class BaseEmailService implements EmailService {
    abstract sendRawEmail(
        options: SendOptions,
        content: ContentOptions,
    ): Promise<void>;

    /**
     * Hand several emails over in one go. The default is the honest loop —
     * a transport with no bulk of its own gains nothing from pretending —
     * and {@link QueuedEmailService} overrides it with a single enqueue.
     */
    async sendRawEmails(
        emails: Array<{ options: SendOptions; content: ContentOptions }>,
    ): Promise<void> {
        for (const email of emails) {
            await this.sendRawEmail(email.options, email.content);
        }
    }

    async sendEmailTemplates(emails: TemplatedEmail[]): Promise<void> {
        const rendered = await Promise.all(
            emails.map(async (email) => ({
                options: email.options,
                content: {
                    type: "html" as const,
                    html: await renderEmailTemplate(
                        email.templateName,
                        email.templateProps,
                    ),
                },
            })),
        );

        await this.sendRawEmails(
            rendered.map((email) => ({
                options: email.options,
                content: {
                    ...email.content,
                    text: toPlainText(email.content.html),
                },
            })),
        );
    }

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
