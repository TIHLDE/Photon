import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type z from "zod";
import {
    canModerateFeedback,
    isFeedbackAuthor,
} from "~/lib/feedback/middleware";
import { getFeedbackItem } from "~/lib/feedback/serialize";
import { sendNotification } from "~/lib/notification";
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
            "Edit a piece of feedback, or move it along its status. Requires 'feedback:update' or 'feedback:manage', or being the author. Only the author may edit the title, description and anonymity, and only while it is open and nobody else has voted or commented. Only the permission may change the status or the rejection reason. Rejecting notifies the author.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: feedbackItemSchema,
            description: "Feedback updated",
        })
        .forbidden({ description: "Insufficient permissions" })
        .response({
            statusCode: 409,
            description:
                "The author can no longer edit it: it has moved past open, or someone else has voted or commented",
        })
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
        const isModerating =
            body.status !== undefined || body.rejectionReason !== undefined;

        const mayModerate =
            !c.get("isResourceOwner") ||
            (await canModerateFeedback(c.get("ctx"), userId));

        if (isModerating && !mayModerate) {
            throw new HTTPException(403, {
                message:
                    "Forbidden - changing the status requires permission: feedback:update or feedback:manage",
            });
        }

        const editsContent =
            body.title !== undefined ||
            body.description !== undefined ||
            body.isAnonymous !== undefined;

        if (editsContent && existing.authorId !== userId) {
            throw new HTTPException(403, {
                message: "Only the author can edit the feedback itself",
            });
        }

        /**
         * Once someone else has voted or replied, they reacted to what was
         * written then — and to the name, or lack of one, shown on it. Letting
         * the author rewrite it afterwards would change what they answered.
         * This holds for authors in Index too.
         */
        if (editsContent) {
            const current = await getFeedbackItem(db, id, userId);

            if (!current?.isEditable) {
                throw new HTTPException(409, {
                    message:
                        "Feedback can only be edited while it is open and nobody else has voted or commented",
                });
            }
        }

        const nextStatus = body.status ?? existing.status;

        if (body.rejectionReason && nextStatus !== "rejected") {
            throw new HTTPException(400, {
                message: "A rejection reason requires the status 'rejected'",
            });
        }

        const rejectionReason =
            nextStatus !== "rejected"
                ? null
                : body.rejectionReason !== undefined
                  ? body.rejectionReason || null
                  : existing.rejectionReason;

        const [updated] = await db
            .update(schema.feedback)
            .set({ ...body, rejectionReason })
            .where(eq(schema.feedback.id, id))
            .returning();

        if (!updated) {
            throw new HTTPException(404, { message: "Feedback not found" });
        }

        const wasJustRejected =
            existing.status !== "rejected" && nextStatus === "rejected";

        if (
            wasJustRejected &&
            existing.authorId &&
            existing.authorId !== userId
        ) {
            try {
                await sendNotification(
                    {
                        userId: existing.authorId,
                        title: "Tilbakemeldingen din ble avvist",
                        description: rejectionReason
                            ? `«${existing.title}»: ${rejectionReason}`
                            : `«${existing.title}»`,
                        link: `/tilbakemelding?id=${id}`,
                    },
                    c.get("ctx"),
                );
            } catch (error) {
                c.get("logger")?.error(
                    { err: error, feedbackId: id },
                    "Failed to send feedback rejection notification",
                );
            }
        }

        const item = await getFeedbackItem(db, id, userId, mayModerate);

        if (!item) {
            throw new HTTPException(404, { message: "Feedback not found" });
        }

        return c.json(item satisfies z.infer<typeof feedbackItemSchema>);
    },
);
