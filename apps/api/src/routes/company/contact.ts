import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { env } from "~/lib/env";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { companyContactResponseSchema, companyContactSchema } from "./schema";

/** Submissions allowed per client within {@link RATE_LIMIT_WINDOW_SECONDS} */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

/**
 * The endpoint is unauthenticated and sends email, so it needs a throttle.
 * Keyed on the forwarded client IP when we have one, falling back to the
 * submitted email address so a proxyless deployment still limits per sender
 * rather than globally.
 */
function rateLimitKey(ip: string | undefined, email: string) {
    return `company-contact:${ip ?? `email:${email.toLowerCase()}`}`;
}

function clientIp(forwardedFor: string | undefined) {
    return forwardedFor?.split(",")[0]?.trim() || undefined;
}

export const contactRoute = route().post(
    "/contact",
    describeRoute({
        tags: ["companies"],
        summary: "Submit company contact form",
        operationId: "submitCompanyContact",
        description:
            "Public endpoint used by the company landing page. Emails the submission to TIHLDE's business contact. Rate limited per client.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: companyContactResponseSchema,
            description: "Submission queued for delivery",
        })
        .badRequest({ description: "Invalid input" })
        .response({
            statusCode: 429,
            description: "Too many submissions from this client",
        })
        .build(),
    validator("json", companyContactSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { cache, email } = c.get("ctx");

        const key = rateLimitKey(
            clientIp(c.req.header("x-forwarded-for")),
            body.contactEmail,
        );
        const attempts = Number(await cache.getString(key)) || 0;
        if (attempts >= RATE_LIMIT_MAX) {
            throw new HTTPException(429, {
                message:
                    "For mange henvendelser. Prøv igjen senere, eller send oss en e-post direkte.",
            });
        }
        await cache.setString(
            key,
            String(attempts + 1),
            RATE_LIMIT_WINDOW_SECONDS,
        );

        await email.sendEmailTemplate(
            {
                from: env.MAIL_FROM,
                to: env.COMPANY_CONTACT_EMAIL,
                subject: `Bedrift: ${body.company} – Ny kontaktforespørsel`,
                replyTo: body.contactEmail,
            },
            "CompanyContactEmail",
            {
                company: body.company,
                contactName: body.contactName,
                contactEmail: body.contactEmail,
                eventTypes: body.eventTypes,
                semesters: body.semesters,
                comment: body.comment || undefined,
                logoUrl: `${env.WEBSITE_URL}/logo512.png`,
            },
        );

        return c.json(
            {
                success: true,
                message: "Henvendelsen ble sendt",
            },
            200,
        );
    },
);
