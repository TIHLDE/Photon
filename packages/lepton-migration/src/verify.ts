import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { sql } from "drizzle-orm";
import { query } from "./mysql";

async function countOld(table: string): Promise<number> {
    const rows = await query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM ${table}`,
    );
    return Number(rows[0]?.cnt ?? 0);
}

async function countNew(
    db: NodePgDatabase<DbSchema>,
    tableName: string,
): Promise<number> {
    const result = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM ${tableName}`),
    );
    return Number(
        (result as any).rows?.[0]?.cnt ?? (result as any)[0]?.cnt ?? 0,
    );
}

export async function verify(db: NodePgDatabase<DbSchema>): Promise<void> {
    console.log("\n========================================");
    console.log("  MIGRATION VERIFICATION");
    console.log("========================================\n");

    const checks = [
        { name: "Users", old: "content_user", new: "auth_user" },
        { name: "Groups", old: "group_group", new: "org_group" },
        {
            name: "Memberships",
            old: "group_membership",
            new: "org_group_membership",
        },
        { name: "Fines", old: "group_fine", new: "org_fine" },
        { name: "Categories", old: "content_category", new: "event_category" },
        { name: "Events", old: "content_event", new: "event_event" },
        {
            name: "Registrations",
            old: "content_registration",
            new: "event_registration",
        },
        { name: "Strikes", old: "content_strike", new: "event_strike" },
        { name: "Payments", old: "payment_order", new: "event_payment" },
        {
            name: "Priority Pools",
            old: "content_prioritypool",
            new: "event_priority_pool",
        },
        {
            name: "Favorites",
            old: "content_event_favorite_users",
            new: "event_favorite",
        },
        { name: "Forms", old: "forms_form", new: "form_form" },
        { name: "Fields", old: "forms_field", new: "form_field" },
        { name: "Options", old: "forms_option", new: "form_option" },
        {
            name: "Submissions",
            old: "forms_submission",
            new: "form_submission",
        },
        { name: "Answers", old: "forms_answer", new: "form_answer" },
        { name: "News", old: "content_news", new: "news_news" },
        { name: "Reactions", old: "emoji_reaction", new: "event_reaction" },
        { name: "Job Posts", old: "career_jobpost", new: "job_job_post" },
        {
            name: "Notifications",
            old: "communication_notification",
            new: "notification_notification",
        },
    ];

    console.log(
        `${"Entity".padEnd(20)} | ${"Old".padStart(6)} | ${"New".padStart(6)}`,
    );
    console.log("-".repeat(40));

    for (const check of checks) {
        try {
            const oldCount = await countOld(check.old);
            const newCount = await countNew(db, check.new);
            console.log(
                `${check.name.padEnd(20)} | ${String(oldCount).padStart(6)} | ${String(newCount).padStart(6)}`,
            );
        } catch (err) {
            console.log(`${check.name.padEnd(20)} | ERROR: ${err}`);
        }
    }

    console.log("\n========================================\n");
}
