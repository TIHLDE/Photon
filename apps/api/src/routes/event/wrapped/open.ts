import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { listOpenCameras } from "~/lib/wrapped";
import { requireAuth } from "~/middleware/auth";
import { openWrappedCamerasSchema } from "./schema";

export const listOpenWrappedCamerasRoute = route().get(
    "/wrapped/open",
    describeRoute({
        tags: ["wrapped"],
        summary: "List the cameras I can take a photo with right now",
        operationId: "listOpenWrappedCameras",
        description:
            "The disposable cameras that are open for the caller at this moment: turned on, inside their window, at an event the caller holds a spot on, and with photos left. Events under way come first, the one that started last on top. This is what the site uses to offer a shortcut to the camera, so it is empty far more often than not.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: openWrappedCamerasSchema,
            description: "OK",
        })
        .unauthorized({ description: "Authentication required" })
        .build(),
    requireAuth,
    async (c) => {
        const cameras = await listOpenCameras(
            c.get("ctx").db,
            c.get("user").id,
        );

        return c.json(
            cameras.map((camera) => ({
                ...camera,
                start: camera.start.toISOString(),
                end: camera.end.toISOString(),
                closesAt: camera.closesAt.toISOString(),
            })) satisfies z.infer<typeof openWrappedCamerasSchema>,
        );
    },
);
