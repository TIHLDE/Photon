import { schema } from "..";
import type { AppContext } from "../../lib/ctx";

// Import all seed modules
import seedAuth from "./auth";
import seedEvent from "./event";
import seedOrg from "./org";
import seedRbac from "./rbac";

/**
 * Main seed orchestrator
 * Runs all seed modules in the correct order
 */
export default async (ctx: AppContext) => {
    const { db } = ctx;

    // Check if this is the first run
    const studyGroupCount = await db
        .select()
        .from(schema.studyProgram)
        .limit(1)
        .then((rows) => rows.length);

    const firstRun = studyGroupCount === 0;

    if (!firstRun) {
        console.log("🌱 Database already seeded, skipping seeding process.");
        return;
    }

    // Run seed modules in order
    // 1. RBAC (roles must exist before users)
    await seedRbac(ctx);

    // 2. Auth (users)
    await seedAuth(ctx);

    // 3. Org (groups)
    await seedOrg(ctx);

    // 4. Event (categories)
    await seedEvent(ctx);

    console.log("🌱 Successfully seeded the database");
};
