import { schema } from "@photon/db";
import type {
    EmailTemplateName,
    EmailTemplateOptions,
} from "@photon/email/templates";
import type { AppContext } from "../ctx";
import { env } from "../env";

type EmailTemplateOverride = {
    [TName in EmailTemplateName]: {
        name: TName;
        props: EmailTemplateOptions<TName>;
    };
}[EmailTemplateName];

export type SendNotificationOptions = {
    userId: string;
    title: string;
    description: string;
    link?: string;
    sendTo?: {
        website?: boolean;
        email?: boolean;
    };
    emailTemplate?: EmailTemplateOverride;
};

/**
 * Send a notification to a user
 *
 * This function can:
 * 1. Create a notification record in the database (if sendTo.website is true)
 * 2. Send an email notification (if sendTo.email is true)
 *
 * @param options Notification options
 * @param options.userId User ID to send notification to
 * @param options.title Notification title
 * @param options.description Notification description
 * @param options.link Optional link URL
 * @param options.sendTo Where to send the notification (default: {website: true, email: true})
 * @param options.emailTemplate Optional custom email template (if not provided, uses NotificationMail)
 * @param ctx Application context
 * @returns The created notification record (if website notification was created), or null
 */
export async function sendNotification(
    options: SendNotificationOptions,
    ctx: AppContext,
) {
    const {
        userId,
        title,
        description,
        link,
        sendTo = { website: true, email: true },
        emailTemplate,
    } = options;

    // Default both to true if not specified
    const shouldSendToWebsite = sendTo.website ?? true;
    const shouldSendToEmail = sendTo.email ?? true;

    // Validate: if email is true, we need either a custom template or valid notification data
    if (shouldSendToEmail && !emailTemplate && (!title || !description)) {
        throw new Error(
            "Either emailTemplate or both title and description must be provided for email notifications",
        );
    }

    let notificationRecord = null;

    // Create notification in database if website notification is enabled
    if (shouldSendToWebsite) {
        const [notification] = await ctx.db
            .insert(schema.notification)
            .values({
                userId,
                title,
                description,
                link: link ?? null,
                isRead: false,
            })
            .returning();

        notificationRecord = {
            id: notification?.id,
            userId,
            title,
            description,
            link,
            isRead: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }

    // Send email notification if enabled
    if (shouldSendToEmail) {
        // Get user email
        const user = await ctx.db.query.user.findFirst({
            where: (user, { eq }) => eq(user.id, userId),
        });

        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }

        let template: EmailTemplateOverride | undefined = emailTemplate;
        template ??= {
            name: "NotificationMail",
            props: {
                title,
                description,
                link,
                logoUrl: `${env.WEBSITE_URL}/logo512.png`,
            },
        };

        await ctx.email.sendEmailTemplate(
            {
                from: env.MAIL_FROM,
                to: user.email,
                subject: title,
            },
            template.name,
            template.props,
        );
    }

    return notificationRecord;
}
