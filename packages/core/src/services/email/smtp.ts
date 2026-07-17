import { createTransport, type Transporter } from "nodemailer";
import {
    BaseEmailService,
    type ContentOptions,
    type SendOptions,
} from "./base";

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
        await this.#smtpTransport.sendMail({
            ...options,
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
