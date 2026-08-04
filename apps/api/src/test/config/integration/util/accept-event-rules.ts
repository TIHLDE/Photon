import { schema } from "@photon/db";
import type { TestUtilContext } from ".";

/**
 * Mark a test user as having accepted the event rules.
 *
 * Registering for an event requires it, so any test that signs a user up must
 * call this first — the same step a real member takes from the notice in the
 * frontend.
 */
export const createAcceptEventRules =
    (ctx: TestUtilContext) => async (userId: string) => {
        await ctx.db
            .insert(schema.userSettings)
            .values({
                userId,
                gender: "other",
                allowsPhotosByDefault: false,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                isOnboarded: false,
            })
            .onConflictDoUpdate({
                target: schema.userSettings.userId,
                set: { acceptsEventRules: true },
            });
    };
