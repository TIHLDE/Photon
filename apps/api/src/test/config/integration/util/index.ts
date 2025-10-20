import type { TestAppContext } from "..";
import type { createApp } from "../../../..";
import { createSetupEventCategories } from "./create-setup-event-categories";
import { createCreateTestUser } from "./create-test-user";
import { createGetClientForUser } from "./get-client-for-user";
import { createSetupGroups } from "./setup-groups";

export type TestUtilContext = TestAppContext & {
    app: Awaited<ReturnType<typeof createApp>>;
};

export const createTestUtils = (ctx: TestUtilContext) => {
    return {
        createTestUser: createCreateTestUser(ctx),
        clientForUser: createGetClientForUser(ctx),
        setupGroups: createSetupGroups(ctx),
        setupEventCategories: createSetupEventCategories(ctx),
    };
};
