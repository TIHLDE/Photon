import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { createFeedbackSchema, feedbackItemSchema } from "./schema";

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["feedback"],
        summary: "Create feedback",
        operationId: "createFeedback",
        description:
            "File an idea or a bug report. Any logged-in member may do this — no permission needed.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: feedbackItemSchema,
            description: "Feedback created",
        })
        .build(),
    requireAuth,
    validator("json", createFeedbackSchema),
    async (c) => {
        const body = c.req.valid("json");
        const user = c.get("user");
        const { db } = c.get("ctx");

        const [created] = await db
            .insert(schema.feedback)
            .values({
                type: body.type,
                title: body.title,
                description: body.description,
                authorId: user.id,
            })
            .returning();

        if (!created) {
            throw new Error("Failed to create feedback");
        }

        return c.json(
            {
                id: created.id,
                type: created.type,
                status: created.status,
                title: created.title,
                description: created.description,
                isAuthor: true,
                upvotes: 0,
                downvotes: 0,
                myVote: null,
                createdAt: created.createdAt.toISOString(),
                updatedAt: created.updatedAt.toISOString(),
            } satisfies z.infer<typeof feedbackItemSchema>,
            201,
        );
    },
);
