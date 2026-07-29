import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { env } from "~/lib/env";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { accountLinkHelpResponseSchema, accountLinkHelpSchema } from "./schema";

/** Requests allowed per client within {@link RATE_LIMIT_WINDOW_SECONDS} */
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

/**
 * Unauthenticated and sends mail, so it needs a throttle. Keyed on the
 * forwarded client IP when there is one, falling back to the address they gave
 * us so a proxyless deployment still limits per sender rather than globally.
 */
function rateLimitKey(ip: string | undefined, email: string) {
    return `account-link-help:${ip ?? `email:${email.toLowerCase()}`}`;
}

function clientIp(forwardedFor: string | undefined) {
    return forwardedFor?.split(",")[0]?.trim() || undefined;
}

export const accountLinkHelpRoute = route().post(
    "/help",
    describeRoute({
        tags: ["account-link"],
        summary: "Ask a human to link a Feide login to an old account",
        operationId: "requestAccountLinkHelp",
        description:
            "Last resort for a member migrated from Lepton whose stored username differs from their NTNU one and who no longer has the email the old account was registered with — nothing in the flow can verify them, so this notifies an admin to do it by hand. Rate limited per client.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: accountLinkHelpResponseSchema,
            description: "Request delivered to an admin",
        })
        .badRequest({ description: "Invalid input" })
        .response({
            statusCode: 429,
            description: "Too many requests from this client",
        })
        .build(),
    validator("json", accountLinkHelpSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { cache, email } = c.get("ctx");
        const logger = c.get("logger");

        const key = rateLimitKey(
            clientIp(c.req.header("x-forwarded-for")),
            body.contactEmail,
        );
        const attempts = Number(await cache.getString(key)) || 0;
        if (attempts >= RATE_LIMIT_MAX) {
            throw new HTTPException(429, {
                message: "For mange forespørsler. Prøv igjen senere.",
            });
        }
        await cache.setString(
            key,
            String(attempts + 1),
            RATE_LIMIT_WINDOW_SECONDS,
        );

        /**
         * Nothing is stored: there is no account to attach this to yet, and
         * the whole point is that we cannot tell who they are. The mail *is*
         * the record. It must therefore succeed loudly — telling the member
         * "vi har varslet" when nobody was notified would leave them waiting
         * for a reply that never comes.
         */
        try {
            await email.sendEmailTemplate(
                {
                    from: env.MAIL_FROM,
                    to: env.ACCOUNT_HELP_EMAIL,
                    subject: `Kontokobling: ${body.feideName} trenger hjelp`,
                    replyTo: body.contactEmail,
                },
                "AccountLinkHelpEmail",
                {
                    feideName: body.feideName,
                    feideUsername: body.feideUsername,
                    contactEmail: body.contactEmail,
                    note: body.note,
                    logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                },
            );
        } catch (error) {
            logger.error(
                { err: error, contactEmail: body.contactEmail },
                "Failed to queue account link help email",
            );
            throw new HTTPException(500, {
                message:
                    "Kunne ikke sende forespørselen. Prøv igjen om litt, eller send en e-post til index@tihlde.org.",
            });
        }

        return c.json(
            { success: true, message: "Forespørselen ble sendt" },
            200,
        );
    },
);
