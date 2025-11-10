import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import {
    UpdateUserSettingsSchema,
    getUserSettings,
    updateUserSettings,
} from "~/lib/user/settings";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

const schemaOpenAPI = await resolver(
    UpdateUserSettingsSchema,
).toOpenAPISchema();

export const updateSettingsRoute = route().patch(
    "/",
    describeRoute({
        tags: ["user"],
        summary: "Update user settings",
        description:
            "Partially update the authenticated user's settings. Only provided fields will be updated. User must have completed onboarding first.",
        requestBody: {
            content: {
                "application/json": { schema: schemaOpenAPI.schema },
            },
        },
        responses: {
            200: {
                description: "Settings updated successfully",
                content: {
                    "application/json": {
                        schema: schemaOpenAPI.schema,
                    },
                },
            },
            400: {
                description: "Bad Request - Invalid input",
            },
            404: {
                description:
                    "Not Found - User settings do not exist (user needs to complete onboarding first)",
            },
        },
    }),
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
