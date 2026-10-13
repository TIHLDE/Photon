import { validator } from "hono-openapi";
import { env } from "~/lib/env";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { overhortResponseSchema, overhortSchema } from "./schema";
import { requireAuth } from "~/middleware/auth";

export const overhortRoute = route().post(
    "/overhort",
    describeRoute({
        tags: ["toddel"],
        summary: "Submit to Overhört",
        operationId: "submitOverhort",
        description:
            "Anonymous endpoint behind the Overhört button on the TÖDDEL page. Emails the submission to TÖDDEL's editor. Requires a signed-in, approved member, but nothing is stored, and nothing about the sender is sent or logged.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: overhortResponseSchema,
            description: "Submission queued for delivery",
        })
        .badRequest({ description: "Invalid input" })
        .build(),
    requireAuth,
    validator("json", overhortSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { email } = c.get("ctx");

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
