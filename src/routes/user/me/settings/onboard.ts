import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeAuthenticatedRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    UserSettingsSchema,
    createUserSettings,
    getUserSettings,
} from "~/lib/user/settings";
import { requireAuth } from "~/middleware/auth";

export const onboardRoute = route().post(
    "/",
    describeAuthenticatedRoute({
        tags: ["user"],
        summary: "Complete user onboarding",
        operationId: "onboardUser",
        description:
            "Create initial user settings and mark the user as onboarded. Can only be called once per user.",
    })
        .schemaResponse(201, UserSettingsSchema, "User onboarded successfully")
        .badRequest("User has already completed onboarding")
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
