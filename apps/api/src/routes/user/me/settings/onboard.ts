import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { createUserSettings } from "~/lib/user/settings";
import { requireAuthAllowPending } from "~/middleware/auth";
import { onboardUserInputSchema, userSettingsSchema } from "../../schema";

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
            schema: userSettingsSchema,
            description: "User onboarded successfully",
        })
        .badRequest({ description: "User has already completed onboarding" })
        .build(),
    requireAuthAllowPending,
    validator("json", onboardUserInputSchema),
    async (c) => {
        const userId = c.get("user").id;
        const body = c.req.valid("json");
        const ctx = c.get("ctx");

        // Only a completed onboarding blocks a new one. A settings row on its
        // own does not: accepting the event rules creates a placeholder row
        // with `isOnboarded` false, and that must not lock the user out of
        // ever answering the real questions.
        const existing = await ctx.db.query.userSettings.findFirst({
            where: (settings, { eq }) => eq(settings.userId, userId),
            columns: { isOnboarded: true },
        });

        if (existing?.isOnboarded) {
            throw new HTTPException(400, {
                message: "User has already completed onboarding",
            });
        }

        // Create settings with onboarded = true
        const settings = await createUserSettings(userId, body, ctx);

        return c.json(settings, 201);
    },
);
