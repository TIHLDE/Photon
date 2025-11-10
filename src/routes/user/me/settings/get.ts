import { describeRoute, resolver } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { route } from "~/lib/route";
import { UserSettingsSchema, getUserSettings } from "~/lib/user/settings";
import { requireAuth } from "~/middleware/auth";

const responseSchema = UserSettingsSchema.extend({
    isOnboarded: z.boolean().meta({
        description: "Whether the user has completed onboarding",
    }),
});

const schemaOpenAPI = await resolver(responseSchema).toOpenAPISchema();

export const getSettingsRoute = route().get(
    "/",
    describeRoute({
        tags: ["user"],
        summary: "Get current user settings",
        description:
            "Retrieve the authenticated user's settings including preferences and allergies.",
        responses: {
            200: {
                description: "User settings retrieved successfully",
                content: {
                    "application/json": {
                        schema: schemaOpenAPI.schema,
                    },
                },
            },
            404: {
                description:
                    "Not Found - User settings do not exist (user needs to complete onboarding)",
            },
        },
    }),
    requireAuth,
    async (c) => {
        const userId = c.get("user").id;
        const ctx = c.get("ctx");
        const { db } = ctx;

        const settings = await getUserSettings(userId, ctx);

        if (!settings) {
            throw new HTTPException(404, {
                message: "User settings not found. Please complete onboarding.",
            });
        }

        // Fetch isOnboarded status
        const userRecord = await db.query.userSettings.findFirst({
            where: (userSettings, { eq }) => eq(userSettings.userId, userId),
            columns: {
                isOnboarded: true,
            },
        });

        return c.json(
            {
                ...settings,
                isOnboarded: userRecord?.isOnboarded ?? false,
            },
            200,
        );
    },
);
