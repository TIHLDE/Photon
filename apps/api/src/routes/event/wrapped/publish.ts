import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { requireEventAccess } from "~/lib/event/access";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { WRAPPED_ARRANGER_PERMISSIONS, getCameraStatus } from "~/lib/wrapped";
import { publishStory } from "~/lib/wrapped/story";
import { requireAuth } from "~/middleware/auth";
import { eventIdParamSchema, wrappedCameraSchema } from "./schema";
import { serializeCameraStatus } from "./serialize";

export const publishWrappedStoryRoute = route().post(
    "/:eventId/wrapped/publish",
    describeRoute({
        tags: ["wrapped"],
        summary: "Publish the event's Wrapped story",
        operationId: "publishWrappedStory",
        description:
            "Put the picked photos live as the event's story for every logged-in member. Only the first publish of an event notifies everyone who held a spot on it (registered, attended or no-show), in the bell and by push; unpublishing and publishing again, or publishing a story that is already live, notifies nobody. A failing notification send does not fail the publish. Requires 'events:update' or 'events:manage', globally or for the arranging group.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: wrappedCameraSchema,
            description: "OK",
        })
        .forbidden({
            description: "Requires events:update or events:manage permission",
        })
        .notFound({ description: "Event not found" })
        .response({
            statusCode: 409,
            description: "No photos are picked yet",
        })
        .build(),
    requireAuth,
    // Before the access check, which would otherwise hand Postgres an id
    // that is not a uuid.
    validator("param", eventIdParamSchema),
    requireEventAccess({ permission: WRAPPED_ARRANGER_PERMISSIONS }),
    async (c) => {
        const ctx = c.get("ctx");
        const { eventId } = c.req.valid("param");

        const logger = c.get("logger");
        const { isFirstPublish, recipientCount } = await publishStory(
            ctx,
            eventId,
            logger,
        );

        logger.info(
            { eventId, isFirstPublish, recipientCount },
            "Wrapped story published",
        );

        const status = await getCameraStatus(ctx, eventId, c.get("user").id);
        if (!status) {
            throw HTTPAppException.NotFound("Event");
        }

        return c.json(serializeCameraStatus(status));
    },
);
