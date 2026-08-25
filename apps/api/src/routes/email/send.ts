import type { MiddlewareHandler } from "hono";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { env } from "~/lib/env";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { sendCustomEmailInputSchema, sendEmailResponseSchema } from "./schema";
import { getBearerTokenFromHeader } from "~/lib/auth";

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

    const result = getBearerTokenFromHeader(c.req.header("Authorization"));
    if (result == null) {
        throw new HTTPException(401, {
            message: "Invalid Authorization header format",
        });
    }

    if (result !== apiKey) {
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
        .forbidden({ description: "Invalid API key or disallowed sender" })
        .response({ statusCode: 503, description: "Email API not configured" })
        .build(),
    requireEmailApiKey,
    validator("json", sendCustomEmailInputSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { ctx } = c.var;

        const from = body.from ?? env.MAIL_FROM;

        // The API key is shared with tools outside this codebase, so a free
        // choice of sender would let any holder of it write as any TIHLDE
        // address. Only what the deployment has listed goes out.
        if (!env.MAIL_ALLOWED_FROM_LIST.includes(from.toLowerCase())) {
            throw new HTTPException(403, {
                message: `Sender ${from} is not allowed. Allowed: ${env.MAIL_ALLOWED_FROM_LIST.join(", ")}`,
            });
        }

        try {
            // Normalize 'to' field to always be an array
            const recipients = Array.isArray(body.to) ? body.to : [body.to];

            await Promise.all(
                recipients.map((recipient) =>
                    ctx.email.sendEmailTemplate(
                        {
                            from,
                            to: recipient,
                            subject: body.subject,
                            ...(body.cc ? { cc: body.cc } : {}),
                            ...(body.bcc ? { bcc: body.bcc } : {}),
                            ...(body.replyTo ? { replyTo: body.replyTo } : {}),
                        },
                        "CustomEmail",
                        {
                            content: body.content,
                            logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                        },
                    ),
                ),
            );

            return c.json(
                {
                    success: true,
                    message: `Email${recipients.length > 1 ? "s" : ""} queued successfully`,
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
