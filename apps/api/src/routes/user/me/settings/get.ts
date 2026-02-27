import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { getUserSettings } from "~/lib/user/settings";
import { requireAuth } from "~/middleware/auth";
import { userSettingsResponseSchema } from "../../schema";

export const getSettingsRoute = route().get(
    "/",
    describeRoute({
        tags: ["users"],
        summary: "Get current user settings",
        operationId: "getUserSettings",
        description:
            "Retrieve the authenticated user's settings including preferences and allergies.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: userSettingsResponseSchema,
            description: "User settings retrieved successfully",
        })
        .notFound({
            description:
                "User settings do not exist (user needs to complete onboarding)",
        })
        .build(),
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
