import type { TestUtilContext } from ".";
import { schema } from "../../../../db";

export const createCreatePendingRegistration =
    (ctx: TestUtilContext) => async (eventId: string, userId: string) => {
        // Insert pending registration in database
        const [reg] = await ctx.db
            .insert(schema.eventRegistration)
            .values({ eventId, userId, status: "pending" })
            .returning();

        if (!reg) {
            throw new Error("Failed to create pending registration");
        }

        return reg;
    };
