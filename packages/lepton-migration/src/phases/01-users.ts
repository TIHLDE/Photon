import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import {
    userIdMap,
    skippedUsers,
    mapGender,
    slugify,
    batchInsert,
} from "../mappings";
import type { AuthInstance } from "../types";

interface LeptonUser {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    gender: number | null;
    allergy: string;
    image: string | null;
    is_superuser: number;
    is_active: number;
    allows_photo_by_default: number;
    accepts_event_rules: number;
    created_at: Date;
    updated_at: Date;
    // from authtoken_token
    key: string | null;
    // from content_userbio
    description: string | null;
    gitHub_link: string | null;
    linkedIn_link: string | null;
}

export async function migrateUsers(
    db: NodePgDatabase<DbSchema>,
    auth: AuthInstance,
): Promise<void> {
    console.log("\n=== Phase 1: Users ===");

    const users = await query<LeptonUser>(`
        SELECT
            cu.*,
            at.key,
            ub.description,
            ub.gitHub_link,
            ub.linkedIn_link
        FROM content_user cu
        LEFT JOIN authtoken_token at ON at.user_id = cu.user_id
        LEFT JOIN content_userbio ub ON ub.user_id = cu.user_id
        ORDER BY cu.created_at ASC
    `);

    console.log(`  Found ${users.length} users in Lepton`);

    // Detect duplicate emails — keep the first occurrence
    const seenEmails = new Set<string>();
    const uniqueUsers: LeptonUser[] = [];
    for (const u of users) {
        const email = u.email.toLowerCase().trim();
        if (seenEmails.has(email)) {
            console.warn(`  SKIP duplicate email: ${u.user_id} (${email})`);
            skippedUsers.add(u.user_id);
            continue;
        }
        seenEmails.add(email);
        uniqueUsers.push(u);
    }

    // Generate a single hashed password to reuse (users will auth via Feide)
    const placeholderPassword = crypto.randomUUID() + crypto.randomUUID();

    let created = 0;
    for (const u of uniqueUsers) {
        try {
            const result = await auth.api.createUser({
                body: {
                    email: u.email.trim(),
                    password: placeholderPassword,
                    name: `${u.first_name} ${u.last_name}`.trim(),
                    role: u.is_superuser ? "admin" : "user",
                    data: {
                        legacyToken: u.key ?? undefined,
                        username: u.user_id,
                    },
                },
            });

            if (result?.user?.id) {
                userIdMap.set(u.user_id, result.user.id);
                created++;
            } else {
                console.warn(`  SKIP user creation returned no id: ${u.user_id}`);
                skippedUsers.add(u.user_id);
            }
        } catch (err) {
            console.warn(`  SKIP user creation failed: ${u.user_id}`, err);
            skippedUsers.add(u.user_id);
        }

        if (created % 50 === 0) {
            console.log(`  Created ${created}/${uniqueUsers.length} users...`);
        }
    }

    console.log(`  Created ${created} auth users`);

    // Collect all unique allergies across users
    const allergySet = new Map<string, string>(); // slug -> label
    for (const u of uniqueUsers) {
        if (!u.allergy || !u.allergy.trim()) continue;
        const parts = u.allergy.split(",").map((s) => s.trim()).filter(Boolean);
        for (const part of parts) {
            const slug = slugify(part).slice(0, 64);
            if (slug && !allergySet.has(slug)) {
                allergySet.set(slug, part.slice(0, 128));
            }
        }
    }

    // Insert allergies
    if (allergySet.size > 0) {
        const allergyRecords = Array.from(allergySet.entries()).map(
            ([slug, label]) => ({ slug, label }),
        );
        await batchInsert(allergyRecords, 500, async (batch) => {
            await db.insert(schema.allergy).values(batch).onConflictDoNothing();
        });
        console.log(`  Inserted ${allergySet.size} allergies`);
    }

    // Insert user_settings
    const settingsRecords: Array<{
        userId: string;
        gender: "male" | "female" | "other";
        allowsPhotosByDefault: boolean;
        acceptsEventRules: boolean;
        imageUrl: string | null;
        bioDescription: string | null;
        githubUrl: string | null;
        linkedinUrl: string | null;
        receiveMailCommunication: boolean;
        isOnboarded: boolean;
    }> = [];

    for (const u of uniqueUsers) {
        const newId = userIdMap.get(u.user_id);
        if (!newId) continue;

        settingsRecords.push({
            userId: newId,
            gender: mapGender(u.gender),
            allowsPhotosByDefault: Boolean(u.allows_photo_by_default),
            acceptsEventRules: Boolean(u.accepts_event_rules),
            imageUrl: u.image ?? null,
            bioDescription: u.description ?? null,
            githubUrl: u.gitHub_link?.slice(0, 256) ?? null,
            linkedinUrl: u.linkedIn_link?.slice(0, 256) ?? null,
            receiveMailCommunication: true,
            isOnboarded: true,
        });
    }

    await batchInsert(settingsRecords, 500, async (batch) => {
        await db.insert(schema.userSettings).values(batch).onConflictDoNothing();
    });
    console.log(`  Inserted ${settingsRecords.length} user settings`);

    // Insert user-allergy junction records
    const allergyJunction: Array<{ userId: string; allergySlug: string }> = [];
    for (const u of uniqueUsers) {
        const newId = userIdMap.get(u.user_id);
        if (!newId || !u.allergy?.trim()) continue;

        const parts = u.allergy.split(",").map((s) => s.trim()).filter(Boolean);
        for (const part of parts) {
            const slug = slugify(part).slice(0, 64);
            if (slug) {
                allergyJunction.push({ userId: newId, allergySlug: slug });
            }
        }
    }

    if (allergyJunction.length > 0) {
        await batchInsert(allergyJunction, 500, async (batch) => {
            await db
                .insert(schema.userAllergy)
                .values(batch)
                .onConflictDoNothing();
        });
        console.log(`  Inserted ${allergyJunction.length} user-allergy links`);
    }

    console.log(`  Phase 1 complete: ${created} users, ${skippedUsers.size} skipped`);
}
