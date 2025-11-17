import type { MiddlewareHandler } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import React from "react";
import { z } from "zod";
import { enqueueEmail } from "~/lib/email";
import { sendCustomEmailSchema } from "~/lib/email/schema";
import { CustomEmail } from "~/lib/email/template/custom-email";
import { env } from "~/lib/env";
import { route } from "~/lib/route";

const sendEmailResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    jobIds: z.array(z.string()),
    recipientCount: z.number(),
});

const sendBodySchemaOpenAPI = await resolver(
    sendCustomEmailSchema,
).toOpenAPISchema();

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

    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
        throw new HTTPException(401, {
            message: "Missing Authorization header",
        });
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
        throw new HTTPException(401, {
            message:
                "Invalid Authorization header format. Expected: Bearer <token>",
        });
    }

    if (token !== apiKey) {
        throw new HTTPException(403, {
            message: "Invalid API key",
        });
    }

    await next();
};

export const sendEmailRoute = route().post(
    "/send",
    describeRoute({
        tags: ["email"],
        summary: "Send custom email",
        operationId: "sendCustomEmail",
        description:
            "Send a custom email with structured content blocks. Requires API key authentication via Bearer token.",
        requestBody: {
            content: {
                "application/json": { schema: sendBodySchemaOpenAPI.schema },
            },
        },
        responses: {
            200: {
                description: "Email queued successfully",
                content: {
                    "application/json": {
                        schema: resolver(sendEmailResponseSchema),
                    },
                },
            },
            401: {
                description: "Missing or invalid Authorization header",
            },
            403: {
                description: "Invalid API key",
            },
            503: {
                description: "Email API not configured",
            },
        },
    }),
    requireEmailApiKey,
    validator("json", sendCustomEmailSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { ctx } = c.var;

        try {
            // Normalize 'to' field to always be an array
            const recipients = Array.isArray(body.to) ? body.to : [body.to];

            // Create the email component
            const emailComponent = React.createElement(CustomEmail, {
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
