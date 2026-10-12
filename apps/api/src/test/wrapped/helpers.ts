import { schema } from "@photon/db";
import type { RegistrationStatus } from "@photon/db/schema";
import type { IntegrationTestContext } from "~/test/config/integration";

const HOUR = 60 * 60 * 1000;

/** An event that is under way, so its camera window is open right now. */
export async function createOngoingEvent(
    ctx: IntegrationTestContext,
    overrides?: Parameters<
        IntegrationTestContext["utils"]["createTestEvent"]
    >[0],
) {
    await ctx.utils.setupGroups();
    await ctx.utils.setupEventCategories();

    const now = Date.now();
    return ctx.utils.createTestEvent({
        slug: `wrapped-${crypto.randomUUID()}`,
        start: new Date(now - HOUR),
        end: new Date(now + HOUR),
        ...overrides,
    });
}

export async function enableCamera(
    ctx: IntegrationTestContext,
    eventId: string,
    shotsPerPerson = 5,
) {
    await ctx.db
        .insert(schema.wrappedCamera)
        .values({ eventId, enabled: true, shotsPerPerson });
}

export async function register(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
    status: RegistrationStatus = "registered",
) {
    await ctx.db
        .insert(schema.eventRegistration)
        .values({ eventId, userId, status });
}
