import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import {
    userIdMap,
    skippedUsers,
    mapMembershipRole,
    mapFineStatus,
    char32ToUuid,
    batchInsert,
    isDroppedGroup,
    resolveGroupSlug,
} from "../mappings";

interface LeptonGroup {
    slug: string;
    name: string;
    description: string | null;
    image: string | null;
    contact_email: string | null;
    type: string;
    fine_info: string;
    fines_activated: number;
    fines_admin_id: string | null;
    created_at: Date;
    updated_at: Date;
}

interface LeptonMembership {
    user_id: string;
    group_id: string;
    membership_type: string;
    created_at: Date;
    updated_at: Date;
}

interface LeptonFine {
    id: string;
    user_id: string;
    group_id: string;
    created_by_id: string;
    amount: number;
    approved: number;
    payed: number;
    description: string;
    reason: string;
    defense: string;
    image: string | null;
    created_at: Date;
    updated_at: Date;
}

export async function migrateGroups(
    db: NodePgDatabase<DbSchema>,
): Promise<void> {
    console.log("\n=== Phase 2: Groups ===");

    // Groups
    const groups = await query<LeptonGroup>("SELECT * FROM group_group");
    console.log(`  Found ${groups.length} groups`);

    const droppedGroups = groups.filter((g) => isDroppedGroup(g.slug));
    if (droppedGroups.length > 0) {
        console.log(
            `  Not modelled as groups in Photon: ${droppedGroups
                .map((g) => g.slug)
                .join(", ")}`,
        );
    }

    const groupRecords = groups
        .filter((g) => !isDroppedGroup(g.slug))
        .map((g) => ({
            slug: g.slug,
            name: g.name.slice(0, 128),
            description: g.description,
            imageUrl: g.image?.slice(0, 600) ?? null,
            contactEmail: g.contact_email?.slice(0, 200) ?? null,
            type: g.type,
            finesInfo: g.fine_info,
            finesActivated: Boolean(g.fines_activated),
            finesAdminId: g.fines_admin_id
                ? (userIdMap.get(g.fines_admin_id) ?? null)
                : null,
            permissionMode: "leader_only" as const,
        }));

    await batchInsert(groupRecords, 500, async (batch) => {
        await db.insert(schema.group).values(batch).onConflictDoNothing();
    });
    console.log(`  Inserted ${groupRecords.length} groups`);

    // Memberships
    const memberships = await query<LeptonMembership>(
        "SELECT * FROM group_membership",
    );
    console.log(`  Found ${memberships.length} memberships`);

    const membershipRecords: Array<{
        userId: string;
        groupSlug: string;
        role: "member" | "leader";
    }> = [];

    /**
     * Study and cohort memberships are still seeded from Lepton rather than
     * left to Feide alone: only a Feide login produces them, so alumni without
     * an active Feide account would otherwise lose their programme and year
     * outright. Feide refreshes them additively from there.
     */
    let droppedMemberships = 0;
    for (const m of memberships) {
        const newUserId = userIdMap.get(m.user_id);
        if (!newUserId) continue;

        const groupSlug = resolveGroupSlug(m.group_id);
        if (!groupSlug) {
            droppedMemberships++;
            continue;
        }

        membershipRecords.push({
            userId: newUserId,
            groupSlug,
            role: mapMembershipRole(m.membership_type),
        });
    }

    if (droppedMemberships > 0) {
        console.log(
            `  Skipped ${droppedMemberships} memberships in groups Photon does not model`,
        );
    }

    await batchInsert(membershipRecords, 500, async (batch) => {
        await db
            .insert(schema.groupMembership)
            .values(batch)
            .onConflictDoNothing();
    });
    console.log(`  Inserted ${membershipRecords.length} memberships`);

    // Fines
    const fines = await query<LeptonFine>("SELECT * FROM group_fine");
    console.log(`  Found ${fines.length} fines`);

    const fineRecords: Array<{
        id: string;
        userId: string;
        groupSlug: string;
        reason: string;
        amount: number;
        defense: string | null;
        image: string | null;
        status: "pending" | "approved" | "paid" | "rejected";
        createdByUserId: string | null;
        approvedAt: Date | null;
        paidAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }> = [];

    for (const f of fines) {
        const newUserId = userIdMap.get(f.user_id);
        if (!newUserId) continue;

        // A fine has to hang off a group that still exists, or the insert
        // trips the foreign key and takes the whole batch down with it.
        const groupSlug = resolveGroupSlug(f.group_id);
        if (!groupSlug) continue;

        const status = mapFineStatus(f.approved, f.payed);

        fineRecords.push({
            id: char32ToUuid(f.id),
            userId: newUserId,
            groupSlug,
            reason: f.reason || f.description,
            amount: f.amount,
            defense: f.defense || null,
            image: f.image || null,
            status,
            createdByUserId: userIdMap.get(f.created_by_id) ?? null,
            approvedAt: f.approved ? f.updated_at : null,
            paidAt: f.payed ? f.updated_at : null,
            createdAt: f.created_at,
            updatedAt: f.updated_at,
        });
    }

    await batchInsert(fineRecords, 500, async (batch) => {
        await db.insert(schema.fine).values(batch).onConflictDoNothing();
    });
    console.log(`  Inserted ${fineRecords.length} fines`);

    console.log("  Phase 2 complete");
}
