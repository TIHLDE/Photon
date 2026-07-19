import { toPlainText } from "@photon/email";
import {
    BaseEmailService,
    type ContentOptions,
    type SendOptions,
} from "./base";

export class ConsoleEmailService extends BaseEmailService {
    async sendRawEmail(
        options: SendOptions,
        content: ContentOptions,
    ): Promise<void> {
        const text =
            content.type === "html"
                ? (content.text ?? toPlainText(content.html))
                : content.text;

        console.log("----- 📧 Email -----");
        console.log("📤 From:", options.from);
        console.log("📥 To:", formatRecipients(options.to));
        if (options.cc) {
            console.log("👥 Cc:", formatRecipients(options.cc));
        }
        if (options.bcc) {
            console.log("👥 Bcc:", formatRecipients(options.bcc));
        }
        console.log("📝 Subject:", options.subject);
        if (options.attachments?.length) {
            console.log("📎 Attachments:", options.attachments.length);
        }
        console.log("💬 Text:");
        console.log(text);
        console.log("-------------------");
    }
}

function formatRecipients(recipients: string | string[]) {
    return Array.isArray(recipients) ? recipients.join(", ") : recipients;
}
