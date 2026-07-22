import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
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

    /**
     * Plain per-table reads with an in-code join, so the phase works both
     * against MySQL and against the JSON table export (which serves single
     * tables only). authtoken_token and content_userbio are not part of the
     * export — legacy tokens no longer exist in Photon's schema, and bios
     * only matter for users being created, so both degrade gracefully.
     */
    const users = await query<LeptonUser>("SELECT * FROM content_user");

    type LeptonBio = {
        user_id: string;
        description: string | null;
        gitHub_link: string | null;
        linkedIn_link: string | null;
    };
    let bioByUser = new Map<string, LeptonBio>();
    try {
        const bios = await query<LeptonBio>("SELECT * FROM content_userbio");
        bioByUser = new Map(bios.map((b) => [b.user_id, b]));
    } catch {
        console.warn("  content_userbio unavailable — bios skipped");
    }
    let tokenByUser = new Map<string, string>();
    try {
        const tokens = await query<{ user_id: string; key: string }>(
            "SELECT * FROM authtoken_token",
        );
        tokenByUser = new Map(tokens.map((t) => [t.user_id, t.key]));
    } catch {
        console.warn("  authtoken_token unavailable — legacy tokens skipped");
    }
    for (const u of users) {
        const bio = bioByUser.get(u.user_id);
        u.key = tokenByUser.get(u.user_id) ?? null;
        u.description = bio?.description ?? null;
        u.gitHub_link = bio?.gitHub_link ?? null;
        u.linkedIn_link = bio?.linkedIn_link ?? null;
    }

    // Duplicate-email preference below keeps the FIRST occurrence, which the
    // SQL used to guarantee via ORDER BY — the JSON export pages by primary
    // key, so the ordering has to be applied here.
    users.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

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

    /**
     * Accounts can already exist before the migration runs: self-registration
     * is open to @stud.ntnu.no addresses and a Feide login creates a user on
     * its first callback. `createUser` fails on the unique email for those,
     * and counting that as "skipped" would leave the member out of
     * `userIdMap` — which silently discards their group memberships, event
     * registrations, strikes, payments, favorites, form answers, reactions
     * and notifications in every later phase. Adopt the existing row instead.
     */
    const existingUsers = await db
        .select({
            id: schema.user.id,
            email: schema.user.email,
            username: schema.user.username,
        })
        .from(schema.user);

    const existingByEmail = new Map(
        existingUsers.map((r) => [r.email.toLowerCase().trim(), r]),
    );

    let created = 0;
    let adopted = 0;
    for (const u of uniqueUsers) {
        const existing = existingByEmail.get(u.email.toLowerCase().trim());
        if (existing) {
            userIdMap.set(u.user_id, existing.id);
            adopted++;

            /**
             * Later phases and `backfill-contact-persons.ts` resolve members
             * by the Lepton user_id kept in `username`. A self-registered
             * account derives its username from the email local part, so it
             * usually already agrees — but never assume it does.
             *
             * Only ever fill an EMPTY username: import-users deliberately
             * sanitized seven legacy ids that violate Better Auth's rules
             * (`'asbjørn loven'` → `asbjorn.loven`, duplicate human `sunnhø`
             * → `sunnho.2`), and overwriting those with the raw Lepton id
             * would undo that. For them, email carries the identity.
             */
            if (existing.username && existing.username !== u.user_id) {
                console.warn(
                    `  ADOPT keeps username "${existing.username}" (lepton id "${u.user_id}") for ${existing.email}`,
                );
            }
            if (!existing.username) {
                try {
                    await db
                        .update(schema.user)
                        .set({
                            username: u.user_id,
                            displayUsername: u.user_id,
                        })
                        .where(eq(schema.user.id, existing.id));
                } catch (err) {
                    console.warn(
                        `  ADOPT could not set username ${u.user_id} on existing ${existing.email}`,
                        err,
                    );
                }
            }

            console.log(
                `  ADOPT existing account for ${u.user_id} (${existing.email})`,
            );
            continue;
        }

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
                console.warn(
                    `  SKIP user creation returned no id: ${u.user_id}`,
                );
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

    console.log(`  Created ${created} auth users, adopted ${adopted} existing`);

    // Collect all unique allergies across users
    const allergySet = new Map<string, string>(); // slug -> label
    for (const u of uniqueUsers) {
        if (!u.allergy || !u.allergy.trim()) continue;
        const parts = u.allergy
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
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
        await db
            .insert(schema.userSettings)
            .values(batch)
            .onConflictDoNothing();
    });
    console.log(`  Inserted ${settingsRecords.length} user settings`);

    // Insert user-allergy junction records
    const allergyJunction: Array<{ userId: string; allergySlug: string }> = [];
    for (const u of uniqueUsers) {
        const newId = userIdMap.get(u.user_id);
        if (!newId || !u.allergy?.trim()) continue;

        const parts = u.allergy
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
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

    console.log(
        `  Phase 1 complete: ${created} users, ${adopted} adopted, ${skippedUsers.size} skipped`,
    );
}
