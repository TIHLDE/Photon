import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { updateUserSettings } from "~/lib/user/settings";
import { requireAuthAllowPending } from "~/middleware/auth";
import {
    updateUserSettingsInputSchema,
    updateUserSettingsResponseSchema,
} from "../../schema";

export const updateSettingsRoute = route().patch(
    "/",
    describeRoute({
        tags: ["users"],
        summary: "Update user settings",
        operationId: "updateUserSettings",
        description:
            "Partially update the authenticated user's settings. Only provided fields will be updated. Settings are created on first update for users who have not onboarded, so a member can accept the event rules without filling in a full profile.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateUserSettingsResponseSchema,
            description: "Settings updated successfully",
        })
        .badRequest({ description: "Invalid input" })
        .build(),
    requireAuthAllowPending,
    validator("json", updateUserSettingsInputSchema),
    async (c) => {
        const userId = c.get("user").id;
        const body = c.req.valid("json");
        const ctx = c.get("ctx");

        // Creates the row when it is missing: a member who never onboarded
        // must still be able to accept the event rules.
        const updatedSettings = await updateUserSettings(userId, body, ctx);

        return c.json(updatedSettings, 200);
    },
);
