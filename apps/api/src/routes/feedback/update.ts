import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { and, eq, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type z from "zod";
import { isFeedbackAuthor } from "~/lib/feedback/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    feedbackIdParamSchema,
    feedbackItemSchema,
    updateFeedbackSchema,
} from "./schema";

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["feedback"],
        summary: "Update feedback",
        operationId: "updateFeedback",
        description:
            "Edit a piece of feedback, or move it along its status. Requires 'feedback:update' or 'feedback:manage', or being the author. Only the permission may change the status.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: feedbackItemSchema,
            description: "Feedback updated",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Feedback not found" })
        .build(),
    requireAuth,
    // Before `requireAccess`: its ownership check looks the row up by this id,
    // so an unparseable one would reach the database there rather than here.
    validator("param", feedbackIdParamSchema),
    requireAccess({
        permission: ["feedback:update", "feedback:manage"],
        ownership: { param: "id", check: isFeedbackAuthor },
    }),
    validator("json", updateFeedbackSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db } = c.get("ctx");
        const { id } = c.req.valid("param");
        const userId = c.get("user").id;

        const existing = await db.query.feedback.findFirst({
            where: eq(schema.feedback.id, id),
        });

        if (!existing) {
            throw new HTTPException(404, { message: "Feedback not found" });
        }

        /**
         * Status is moderation, not editing. `requireAccess` lets the author
         * through on ownership alone, so without this an author could close
         * their own bug report — or mark it "under arbeid" — and make the
         * board say something Index never decided. Ownership is checked first
         * in that middleware, so a moderator editing their own feedback also
         * arrives here as the owner: the permission is re-checked rather than
         * inferred from `isResourceOwner` being false.
         */
        if (body.status !== undefined && c.get("isResourceOwner")) {
            const mayModerate = await hasPermission(c.get("ctx"), userId, [
                "feedback:update",
                "feedback:manage",
            ]);

            if (!mayModerate) {
                throw new HTTPException(403, {
                    message:
                        "Forbidden - changing the status requires permission: feedback:update or feedback:manage",
                });
            }
        }

        const [updated] = await db
            .update(schema.feedback)
            .set(body)
            .where(eq(schema.feedback.id, id))
            .returning();

        if (!updated) {
            throw new HTTPException(404, { message: "Feedback not found" });
        }

        const [counts] = await db
            .select({
                upvotes:
                    sql<number>`count(*) filter (where ${schema.feedbackVote.value} = 'up')`.mapWith(
                        Number,
                    ),
                downvotes:
                    sql<number>`count(*) filter (where ${schema.feedbackVote.value} = 'down')`.mapWith(
                        Number,
                    ),
            })
            .from(schema.feedbackVote)
            .where(eq(schema.feedbackVote.feedbackId, id));

        const myVote = await db.query.feedbackVote.findFirst({
            where: and(
                eq(schema.feedbackVote.feedbackId, id),
                eq(schema.feedbackVote.userId, userId),
            ),
        });

        return c.json({
            id: updated.id,
            type: updated.type,
            status: updated.status,
            title: updated.title,
            description: updated.description,
            isAuthor: updated.authorId === userId,
            upvotes: counts?.upvotes ?? 0,
            downvotes: counts?.downvotes ?? 0,
            myVote: myVote?.value ?? null,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
        } satisfies z.infer<typeof feedbackItemSchema>);
    },
);
