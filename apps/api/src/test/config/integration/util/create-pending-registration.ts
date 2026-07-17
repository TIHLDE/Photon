import { schema } from "@photon/db";
import type { TestUtilContext } from ".";

export const createCreatePendingRegistration =
    (ctx: TestUtilContext) => async (eventId: string, userId: string) => {
        const now = new Date();

        // Insert pending registration in database
        const [reg] = await ctx.db
            .insert(schema.eventRegistration)
            .values({
                eventId,
                userId,
                status: "pending",
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        if (!reg) {
            throw new Error("Failed to create pending registration");
        }

        return reg;
    };
