import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { requireEventAccess } from "~/lib/event/access";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { WRAPPED_ARRANGER_PERMISSIONS, getCameraStatus } from "~/lib/wrapped";
import { unpublishStory } from "~/lib/wrapped/story";
import { requireAuth } from "~/middleware/auth";
import { eventIdParamSchema, wrappedCameraSchema } from "./schema";
import { serializeCameraStatus } from "./serialize";

export const unpublishWrappedStoryRoute = route().post(
    "/:eventId/wrapped/unpublish",
    describeRoute({
        tags: ["wrapped"],
        summary: "Unpublish the event's Wrapped story",
        operationId: "unpublishWrappedStory",
        description:
            "Take the story down for members. Nothing is deleted: likes and comments come back if the story is published again, and that publish notifies nobody. Requires 'events:update' or 'events:manage', globally or for the arranging group.",
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
        .build(),
    requireAuth,
    // Before the access check, which would otherwise hand Postgres an id
    // that is not a uuid.
    validator("param", eventIdParamSchema),
    requireEventAccess({ permission: WRAPPED_ARRANGER_PERMISSIONS }),
    async (c) => {
        const ctx = c.get("ctx");
        const { eventId } = c.req.valid("param");

        await unpublishStory(ctx, eventId);

        c.get("logger").info({ eventId }, "Wrapped story unpublished");

        const status = await getCameraStatus(ctx, eventId, c.get("user").id);
        if (!status) {
            throw HTTPAppException.NotFound("Event");
        }

        return c.json(serializeCameraStatus(status));
    },
);
