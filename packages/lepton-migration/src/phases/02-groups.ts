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

    const groupRecords = groups.map((g) => ({
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

    for (const m of memberships) {
        const newUserId = userIdMap.get(m.user_id);
        if (!newUserId) continue;

        membershipRecords.push({
            userId: newUserId,
            groupSlug: m.group_id,
            role: mapMembershipRole(m.membership_type),
        });
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

        const status = mapFineStatus(f.approved, f.payed);

        fineRecords.push({
            id: char32ToUuid(f.id),
            userId: newUserId,
            groupSlug: f.group_id,
            reason: f.reason || f.description,
            amount: f.amount,
            defense: f.defense || null,
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
