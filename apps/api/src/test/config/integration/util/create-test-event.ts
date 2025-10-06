import type { InferInsertModel } from "drizzle-orm";
import type { TestUtilContext } from ".";
import { schema } from "../../../../db";

type EventInsert = InferInsertModel<typeof schema.event>;

export const createCreateTestEvent =
    (ctx: TestUtilContext) => async (overrides?: Partial<EventInsert>) => {
        const now = Date.now();
        const defaults: EventInsert = {
            title: "Test Event",
            slug: `test-event-${now}`,
            categorySlug: "bedpres",
            start: new Date(now + 7 * 24 * 60 * 60 * 1000), // 1 week from now
            end: new Date(now + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // +2 hours
            registrationStart: new Date(now - 1 * 60 * 60 * 1000), // 1 hour ago
            registrationEnd: new Date(now + 6 * 24 * 60 * 60 * 1000), // 6 days from now
            capacity: 10,
            requiresSigningUp: true,
            isRegistrationClosed: false,
            enforcesPreviousStrikes: true,
            ...overrides,
        };

        const [event] = await ctx.db
            .insert(schema.event)
            .values(defaults)
            .returning();

        if (!event) {
            throw new Error("Failed to create test event");
        }

        return event;
    };
