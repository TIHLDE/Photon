import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { env } from "~/lib/env";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { overhortResponseSchema, overhortSchema } from "./schema";

/**
 * Submissions allowed in total within {@link RATE_LIMIT_WINDOW_SECONDS}. The
 * window is fixed: it starts with the first submission and does not move.
 */
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

/**
 * One counter shared by everyone. A per-client limit would have to key on the
 * sender's IP, which the anonymity of the form rules out, so this only caps
 * how many mails the editor can be flooded with.
 */
const RATE_LIMIT_KEY = "overhort:global";

export const overhortRoute = route().post(
    "/overhort",
    describeRoute({
        tags: ["toddel"],
        summary: "Submit to Overhört",
        operationId: "submitOverhort",
        description:
            "Public, anonymous endpoint behind the Overhört button on the TÖDDEL page. Emails the submission to TÖDDEL's editor. Nothing is stored, and nothing about the sender is read, sent or logged. Limited to a fixed number of submissions per hour in total, not per client.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: overhortResponseSchema,
            description: "Submission queued for delivery",
        })
        .badRequest({ description: "Invalid input" })
        .response({
            statusCode: 429,
            description: "Too many submissions in total this hour",
        })
        .build(),
    // Deliberately no requireAuth: it would tag the request logger with the
    // sender's user ID, and the submission must not be traceable to anyone.
    validator("json", overhortSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { cache, email } = c.get("ctx");

        // Atomic: parallel requests cannot share one count and slip past.
        const submissions = await cache.increment(
            RATE_LIMIT_KEY,
            RATE_LIMIT_WINDOW_SECONDS,
        );
        if (submissions > RATE_LIMIT_MAX) {
            throw new HTTPException(429, {
                message: "For mange innsendinger. Prøv igjen senere.",
            });
        }

        // No replyTo and no sender details: the editor gets the two fields and
        // nothing else.
        await email.sendEmailTemplate(
            {
                from: env.MAIL_FROM,
                to: env.OVERHORT_EMAIL,
                subject: "Overhört: ny innsending",
            },
            "OverhortEmail",
            {
                name: body.name,
                statement: body.statement,
                logoUrl: `${env.WEBSITE_URL}/logo512.png`,
            },
        );

        return c.json({ message: "Innsendingen ble sendt" }, 200);
    },
);
