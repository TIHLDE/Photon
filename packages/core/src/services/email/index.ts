import { toPlainText } from "@photon/email";

type SendOptions = {
    from: string;
    to: string | string[];
    subject: string;

    cc?: string;
    bcc?: string;
};

type ContentOptions =
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

    // Email Templates
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
    async sendPasswordResetMail(options: { to: string; url: string }) {
        throw "Unimplemented";
    }
    async sendVerifyEmailMail(options: { to: string; url: string }) {
        throw "Unimplemented";
    }
}
