import { LOGO_CID, LOGO_PNG_BASE64, LOGO_SRC } from "@photon/email";
import { createTransport, type Transporter } from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";
import {
    BaseEmailService,
    type ContentOptions,
    type SendOptions,
} from "./base";

/**
 * Added here, at the last step, rather than when the template is rendered:
 * the rendered mail sits in the queue first, and a copy of the image in every
 * queued job would only bloat Redis.
 */
const LOGO_ATTACHMENT: Attachment = {
    filename: "tihlde-logo.png",
    content: LOGO_PNG_BASE64,
    encoding: "base64",
    contentType: "image/png",
    contentDisposition: "inline",
    cid: LOGO_CID,
};

export class SMTPEmailService extends BaseEmailService {
    #smtpTransport: Transporter;

    constructor(options: Parameters<typeof createTransport>[0]) {
        super();
        this.#smtpTransport = createTransport(options);
    }

    async sendRawEmail(
        options: SendOptions,
        content: ContentOptions,
    ): Promise<void> {
        const usesInlineLogo =
            content.type === "html" && content.html.includes(LOGO_SRC);

        await this.#smtpTransport.sendMail({
            ...options,
            attachments: usesInlineLogo
                ? [...(options.attachments ?? []), LOGO_ATTACHMENT]
                : options.attachments,
            ...(content.type === "html"
                ? {
                      html: content.html,
                      text: content.text,
                  }
                : {
                      text: content.text,
                  }),
        });
    }
}
