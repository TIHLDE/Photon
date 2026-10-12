import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { getCameraStatus } from "~/lib/wrapped";
import { requireAuth } from "~/middleware/auth";
import { eventIdParamSchema, wrappedCameraSchema } from "./schema";
import { serializeCameraStatus } from "./serialize";

export const getWrappedCameraRoute = route().get(
    "/:eventId/wrapped",
    describeRoute({
        tags: ["wrapped"],
        summary: "Get the event's camera status",
        operationId: "getWrappedCamera",
        description:
            "The disposable camera of an event, as it looks to the caller: whether it is on, when it is open, how many photos they have left and — if they cannot take one — why. Members only. An event whose camera was never configured answers with `enabled: false`.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: wrappedCameraSchema,
            description: "OK",
        })
        .notFound({ description: "Event not found" })
        .unauthorized({ description: "Authentication required" })
        .build(),
    requireAuth,
    validator("param", eventIdParamSchema),
    async (c) => {
        const { eventId } = c.req.valid("param");

        const status = await getCameraStatus(
            c.get("ctx"),
            eventId,
            c.get("user").id,
        );
        if (!status) {
            throw HTTPAppException.NotFound("Event");
        }

        return c.json(serializeCameraStatus(status));
    },
);
