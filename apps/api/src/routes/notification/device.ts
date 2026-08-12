import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";
import {
    deviceResponseSchema,
    registerDeviceSchema,
    unregisterDeviceSchema,
} from "./schema";

export const registerDeviceRoute = route().post(
    "/device",
    describeRoute({
        tags: ["notifications"],
        summary: "Register a device for push notifications",
        operationId: "registerNotificationDevice",
        description:
            "Stores the Expo push token of the calling user's device. Registering a token that already exists moves it to the authenticated user, so a shared phone never keeps notifying its previous owner.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deviceResponseSchema,
            description: "Device registered",
        })
        .build(),
    requireAuth,
    validator("json", registerDeviceSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const { token, platform } = c.req.valid("json");

        await db
            .insert(schema.notificationDevice)
            .values({ userId, token, platform })
            .onConflictDoUpdate({
                target: schema.notificationDevice.token,
                set: { userId, platform, updatedAt: new Date() },
            });

        return c.json({ success: true });
    },
);

export const unregisterDeviceRoute = route().delete(
    "/device",
    describeRoute({
        tags: ["notifications"],
        summary: "Unregister a device from push notifications",
        operationId: "unregisterNotificationDevice",
        description:
            "Removes the Expo push token, typically on logout. Deleting a token that is not registered is a no-op.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deviceResponseSchema,
            description: "Device unregistered",
        })
        .build(),
    requireAuth,
    validator("json", unregisterDeviceSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const { token } = c.req.valid("json");

        // Scoped to the caller so one user cannot silence another user's phone
        // by guessing its token.
        await db
            .delete(schema.notificationDevice)
            .where(
                and(
                    eq(schema.notificationDevice.token, token),
                    eq(schema.notificationDevice.userId, userId),
                ),
            );

        return c.json({ success: true });
    },
);
