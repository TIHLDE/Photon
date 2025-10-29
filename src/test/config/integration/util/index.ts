import type { TestAppContext } from "..";
import type { createApp } from "../../../..";
import { createCreatePendingRegistration } from "./create-pending-registration";
import { createSetupEventCategories } from "./create-setup-event-categories";
import { createCreateTestEvent } from "./create-test-event";
import { createCreateTestUser } from "./create-test-user";
import { createGetClient } from "./get-client";
import { createGetClientForUser } from "./get-client-for-user";
import { createGiveUserPermissions } from "./give-user-permission";
import { createSetupGroups } from "./setup-groups";

export type TestUtilContext = TestAppContext & {
    app: Awaited<ReturnType<typeof createApp>>;
};

export const createTestUtils = (ctx: TestUtilContext) => {
    return {
        createTestUser: createCreateTestUser(ctx),
        client: createGetClient(ctx),
        clientForUser: createGetClientForUser(ctx),
        setupGroups: createSetupGroups(ctx),
        setupEventCategories: createSetupEventCategories(ctx),
        createTestEvent: createCreateTestEvent(ctx),
        createPendingRegistration: createCreatePendingRegistration(ctx),
        giveUserPermissions: createGiveUserPermissions(ctx),
    };
};
