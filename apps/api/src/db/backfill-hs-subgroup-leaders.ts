/**
 * One-shot backfill: seat every CURRENT subgroup leader into Hovedstyret (HS)
 * with their linked leader-verv.
 *
 * This is a catch-up for leaders who were already sitting BEFORE the mechanism
 * existed — or before their group became a subgroup (e.g. Beta →
 * Innovasjonsminister). The runtime already keeps HS in sync automatically on
 * every subgroup leadership change (see `syncSubgroupLeaderIntoHs`, called from
 * `addUserToGroup` / `updateGroupMemberRole`), so no code path needs this after
 * the fact — it only backfills existing state.
 *
 * Generic: it applies to ALL groups of type "subgroup". New subgroups need no
 * bespoke handling here; the rule is the same for every subgroup leader.
 *
 * Idempotent: `syncSubgroupLeaderIntoHs` adds the hs membership with
 * onConflictDoNothing and replaces the verv holder, so re-runs are safe.
 *
 * NOTE on naming: a leader gets the *named* minister verv only if a position
 * with `linkedGroupSlug = <subgroup>` already exists (e.g. the seeded
 * Teknologiminister ↔ index, Innovasjonsminister ↔ beta). If none is linked
 * yet, the sync creates a generic "Leder av <gruppe>" verv instead. Ensure the
 * named verv (and the group's `type = SUBGROUP`) are in place first if you want
 * the nice title.
 *
 * Run against the target database (uses env.DATABASE_URL):
 *   cd apps/api && bun run src/db/backfill-hs-subgroup-leaders.ts
 */
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { createAppContext } from "~/lib/ctx";
import { isSubgroupType, syncSubgroupLeaderIntoHs } from "~/lib/group";

async function main() {
    const ctx = await createAppContext();

    const groups = await ctx.db.select().from(schema.group);
    const subgroups = groups.filter((group) => isSubgroupType(group.type));

    let seated = 0;
    let skipped = 0;

    for (const group of subgroups) {
        const leaders = await ctx.db
            .select({ userId: schema.groupMembership.userId })
            .from(schema.groupMembership)
            .where(
                and(
                    eq(schema.groupMembership.groupSlug, group.slug),
                    eq(schema.groupMembership.role, "leader"),
                ),
            );

        if (leaders.length === 0) {
            console.log(`• ${group.slug}: no leader — skipped`);
            skipped++;
            continue;
        }

        for (const { userId } of leaders) {
            await syncSubgroupLeaderIntoHs(ctx, userId, group);
            seated++;
            console.log(`✅ ${group.slug}: seated ${userId} into HS`);
        }
    }

    console.log(
        `\nDone. subgroups=${subgroups.length} seated=${seated} skipped=${skipped}`,
    );
    process.exit(0);
}

await main();
