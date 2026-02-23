import { parseBearer } from "@photon/auth/bearer";
import { enqueueEmail } from "@photon/email";
import { sendCustomEmailSchema } from "@photon/email/schema";
import { CustomEmail } from "@photon/email/templates";
import type { MiddlewareHandler } from "hono";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { env } from "~/lib/env";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

const sendEmailResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    jobIds: z.array(z.string()),
    recipientCount: z.number(),
});

/**
 * Middleware to validate API key from Bearer token
 */
const requireEmailApiKey: MiddlewareHandler = async (c, next) => {
    const apiKey = env.EMAIL_API_KEY;

    if (!apiKey) {
        throw new HTTPException(503, {
            message: "Email API is not configured on this server",
        });
    }

    const result = parseBearer(c.req.header("Authorization"));
    if (!result.success) {
        throw new HTTPException(401, { message: result.error });
    }

    if (result.token !== apiKey) {
        throw new HTTPException(403, {
            message: "Invalid API key",
        });
    }

    await next();
};

export const sendEmailRoute = route().post(
    "/send",
    describeRoute({
        tags: ["emails"],
        summary: "Send custom email",
        operationId: "sendCustomEmail",
        description:
            "Send a custom email with structured content blocks. Requires API key authentication via Bearer token.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: sendEmailResponseSchema,
            description: "Email queued successfully",
        })
        .unauthorized({
            description: "Missing or invalid Authorization header",
        })
        .forbidden({ description: "Invalid API key" })
        .response({ statusCode: 503, description: "Email API not configured" })
        .build(),
    requireEmailApiKey,
    validator("json", sendCustomEmailSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { ctx } = c.var;

        try {
            // Normalize 'to' field to always be an array
            const recipients = Array.isArray(body.to) ? body.to : [body.to];

            // Create the email component
            const emailComponent = CustomEmail({
                content: body.content,
            });

            // Queue one email job for each recipient
            const jobs = await Promise.all(
                recipients.map((recipient) =>
                    enqueueEmail(
                        {
                            to: recipient,
                            subject: body.subject,
                            component: emailComponent,
                        },
                        ctx,
                    ),
                ),
            );

            const jobIds = jobs.map((job) => job.id);

            return c.json(
                {
                    success: true,
                    message: `Email${recipients.length > 1 ? "s" : ""} queued successfully`,
                    jobIds,
                    recipientCount: recipients.length,
                },
                200,
            );
        } catch (error) {
            console.error("Failed to queue email:", error);
            throw new HTTPException(500, {
                message: "Failed to queue email",
            });
        }
    },
);
