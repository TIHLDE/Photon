import { requireAuth } from "@photon/auth/server";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    UserSettingsSchema,
    createUserSettings,
    getUserSettings,
} from "~/lib/user/settings";

export const onboardRoute = route().post(
    "/",
    describeRoute({
        tags: ["users"],
        summary: "Complete user onboarding",
        operationId: "onboardUser",
        description:
            "Create initial user settings and mark the user as onboarded. Can only be called once per user.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: UserSettingsSchema,
            description: "User onboarded successfully",
        })
        .badRequest({ description: "User has already completed onboarding" })
        .build(),
    requireAuth,
    validator("json", UserSettingsSchema),
    async (c) => {
        const userId = c.get("user").id;
        const body = c.req.valid("json");
        const ctx = c.get("ctx");

        // Check if user already has settings
        const existingSettings = await getUserSettings(userId, ctx);

        if (existingSettings) {
            throw new HTTPException(400, {
                message: "User has already completed onboarding",
            });
        }

        // Create settings with onboarded = true
        const settings = await createUserSettings(userId, body, ctx);

        return c.json(settings, 201);
    },
);
