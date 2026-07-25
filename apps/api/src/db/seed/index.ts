import { schema } from "@photon/db";
import type { AppContext } from "~/lib/ctx";

// Import all seed modules
import seedAuth from "./auth";
import seedEvent from "./event";
import seedOrg, { backfillGroupData, syncHsPositions } from "./org";
import seedRbac, { backfillRolePermissions } from "./rbac";
import seedUser from "./user";

/**
 * Idempotent steps that must run on EVERY boot, not just the first.
 *
 * The seed below bails out entirely once the database has content, and the
 * inserts it does make are onConflictDoNothing — so without this, an
 * environment that was seeded before a permission, role link, or group field
 * existed would never pick it up. Everything here only fills in what is
 * missing; nothing is removed or overwritten.
 */
async function runBackfills(ctx: AppContext) {
    await backfillRolePermissions(ctx);
    await backfillGroupData(ctx);
    await syncHsPositions(ctx);
}

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
        await runBackfills(ctx);
        console.log(
            "🌱 Database already seeded, ran idempotent backfills only.",
        );
        return;
    }

    // Run seed modules in order
    // 1. RBAC (roles must exist before users)
    await seedRbac(ctx);

    // 2. User (allergies - reference data)
    await seedUser(ctx);

    // 3. Auth (users)
    await seedAuth(ctx);

    // 4. Org (groups)
    await seedOrg(ctx);

    // 5. Event (categories)
    await seedEvent(ctx);

    await runBackfills(ctx);

    console.log("🌱 Successfully seeded the database");
};
