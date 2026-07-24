/**
 * One-shot backfill: wire every subgroup's leadership to Hovedstyret (HS).
 *
 * The runtime already keeps HS in sync automatically on every subgroup
 * leadership change (see `syncSubgroupLeaderIntoHs`, called from
 * `addUserToGroup` / `updateGroupMemberRole`). This script only backfills
 * EXISTING state: it links each subgroup's minister-verv and seats whoever is
 * currently leader — a catch-up for leaders who were already sitting before the
 * mechanism existed.
 *
 * Two idempotent steps, run in order:
 *   1. Link each subgroup's named minister-verv (Teknologiminister,
 *      Innovasjonsminister, …) to the subgroup via `linkedGroupSlug`, creating
 *      the verv in HS if it's missing. This makes the leader inherit the NAMED
 *      title instead of a generic "Leder av <gruppe>".
 *   2. Seat every current subgroup leader into HS with that verv.
 *
 * Generic where it can be: step 2 covers ALL `type = "subgroup"` groups, so new
 * subgroups need no bespoke handling. Step 1 needs the org-specific verv name
 * per subgroup — the six TIHLDE subgroups (see /opptak "Undergrupper"). Subgroup
 * slugs are read from the DB at runtime, so this makes no assumption about them.
 *
 * Idempotent: linking checks for an existing link first, and
 * `syncSubgroupLeaderIntoHs` adds the hs membership with onConflictDoNothing and
 * replaces the verv holder — so re-runs are safe.
 *
 * Run against the target database (uses env.DATABASE_URL):
 *   cd apps/api && bun run src/db/backfill-hs-subgroup-leaders.ts
 */
import { type DbSchema, schema } from "@photon/db";
import { and, eq, type InferSelectModel } from "drizzle-orm";
import { createAppContext } from "~/lib/ctx";
import {
    HS_GROUP_SLUG,
    isSubgroupType,
    syncSubgroupLeaderIntoHs,
} from "~/lib/group";

/**
 * Subgroup display name → the HS minister-verv its leader should hold. These are
 * the six TIHLDE subgroups. Matched on `group.name` (stable and human-visible);
 * the slug is taken from the matched group row, not assumed here.
 */
const MINISTER_BY_SUBGROUP_NAME: Record<string, string> = {
    Index: "Teknologiminister",
    Beta: "Innovasjonsminister",
    Sosialen: "Sosialminister",
    Promo: "Promoteringsminister",
    "Kiosk og Kontor": "Kontorminister",
    "Næringsliv og Kurs": "Næringslivsminister",
};

/** Match resiliently: ignore surrounding whitespace and letter case. */
const normalizeName = (name: string) => name.trim().toLowerCase();
const MINISTER_BY_NORMALIZED_NAME = new Map(
    Object.entries(MINISTER_BY_SUBGROUP_NAME).map(([name, minister]) => [
        normalizeName(name),
        minister,
    ]),
);

type Ctx = Awaited<ReturnType<typeof createAppContext>>;
type Group = InferSelectModel<DbSchema["group"]>;

/**
 * Ensure the subgroup's named minister-verv exists in HS and is linked to it.
 * No-op if some verv is already linked to this subgroup (idempotent).
 */
async function ensureLinkedMinisterVerv(
    ctx: Ctx,
    group: Group,
    ministerName: string,
): Promise<void> {
    const [alreadyLinked] = await ctx.db
        .select({ id: schema.groupPosition.id })
        .from(schema.groupPosition)
        .where(eq(schema.groupPosition.linkedGroupSlug, group.slug))
        .limit(1);
    if (alreadyLinked) return;

    const [existing] = await ctx.db
        .select({ id: schema.groupPosition.id })
        .from(schema.groupPosition)
        .where(
            and(
                eq(schema.groupPosition.groupSlug, HS_GROUP_SLUG),
                eq(schema.groupPosition.name, ministerName),
            ),
        )
        .limit(1);

    if (existing) {
        await ctx.db
            .update(schema.groupPosition)
            .set({ linkedGroupSlug: group.slug })
            .where(eq(schema.groupPosition.id, existing.id));
        console.log(`🔗 linked "${ministerName}" → ${group.slug}`);
    } else {
        await ctx.db.insert(schema.groupPosition).values({
            groupSlug: HS_GROUP_SLUG,
            name: ministerName,
            description: `Leder av ${group.name}`,
            permissions: [],
            scope: "global",
            linkedGroupSlug: group.slug,
        });
        console.log(`➕ created "${ministerName}" linked → ${group.slug}`);
    }
}

async function main() {
    const ctx = await createAppContext();

    const groups = await ctx.db.select().from(schema.group);
    const subgroups = groups.filter((group) => isSubgroupType(group.type));

    // Step 1: link the named minister-verv for each known subgroup.
    for (const group of subgroups) {
        const ministerName = MINISTER_BY_NORMALIZED_NAME.get(
            normalizeName(group.name),
        );
        if (!ministerName) {
            console.log(
                `⚠️  ${group.slug} ("${group.name}"): no minister mapping — leader will get a generic "Leder av …" verv`,
            );
            continue;
        }
        await ensureLinkedMinisterVerv(ctx, group, ministerName);
    }

    // Step 2: seat every current subgroup leader into HS with their verv.
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
