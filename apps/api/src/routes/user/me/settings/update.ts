import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    UpdateUserSettingsSchema,
    getUserSettings,
    updateUserSettings,
} from "~/lib/user/settings";
import { requireAuth } from "~/middleware/auth";
import { updateUserSettingsResponseSchema } from "../../schema";

export const updateSettingsRoute = route().patch(
    "/",
    describeRoute({
        tags: ["users"],
        summary: "Update user settings",
        operationId: "updateUserSettings",
        description:
            "Partially update the authenticated user's settings. Only provided fields will be updated. User must have completed onboarding first.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateUserSettingsResponseSchema,
            description: "Settings updated successfully",
        })
        .badRequest({ description: "Invalid input" })
        .notFound({
            description:
                "User settings do not exist (user needs to complete onboarding first)",
        })
        .build(),
    requireAuth,
    validator("json", UpdateUserSettingsSchema),
    async (c) => {
        const userId = c.get("user").id;
        const body = c.req.valid("json");
        const ctx = c.get("ctx");

        // Check if user has settings
        const existingSettings = await getUserSettings(userId, ctx);

        if (!existingSettings) {
            throw new HTTPException(404, {
                message:
                    "User settings not found. Please complete onboarding first.",
            });
        }

        // Update settings
        const updatedSettings = await updateUserSettings(userId, body, ctx);

        return c.json(updatedSettings, 200);
    },
);
