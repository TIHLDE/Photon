import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import {
    UserSettingsSchema,
    createUserSettings,
    getUserSettings,
} from "~/lib/user/settings";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

const schemaOpenAPI = await resolver(UserSettingsSchema).toOpenAPISchema();

export const onboardRoute = route().post(
    "/",
    describeRoute({
        tags: ["user"],
        summary: "Complete user onboarding",
        description:
            "Create initial user settings and mark the user as onboarded. Can only be called once per user.",
        requestBody: {
            content: {
                "application/json": { schema: schemaOpenAPI.schema },
            },
        },
        responses: {
            201: {
                description: "User onboarded successfully",
                content: {
                    "application/json": {
                        schema: schemaOpenAPI.schema,
                    },
                },
            },
            400: {
                description:
                    "Bad Request - User has already completed onboarding",
            },
        },
    }),
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
