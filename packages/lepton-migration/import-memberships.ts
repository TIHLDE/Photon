/**
 * Imports group memberships from Lepton's export into Photon.
 *
 * Reads the cache written by `fetch-lepton-memberships.ts` and inserts
 * `org_group_membership` rows. Users and groups must already be imported —
 * this only draws the edges between them.
 *
 * Members are resolved by *email*, not username: seven legacy Lepton ids were
 * sanitized during the user import ("sunnhø" became sunnho.2), so the email is
 * the one key guaranteed to agree between the two systems. The Lepton user_id
 * is translated to an email via the user export cache.
 *
 * `created_at` follows the membership over: "medlem siden" is when someone
 * actually joined the group in Lepton, not when the import happened to run.
 * A row that already exists only ever gets its date moved *earlier* — a
 * membership created natively in Photon after the migration keeps its own
 * date, and a re-run never drags anything forward.
 *
 * Idempotent: the (user, group) pair conflicts are resolved as described
 * above, and a settled re-run reports zero new and zero corrected rows.
 * Without --commit nothing is written.
 *
 * Usage: DATABASE_URL=... bun import-memberships.ts [--commit]
 */
import { DISABLED_TIMEOUTS, createDb, schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { resolveGroupSlug } from "./src/mappings";

const commit = process.argv.includes("--commit");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("DATABASE_URL må være satt");
    process.exit(1);
}

type LeptonMembership = {
    user: { user_id: string; email: string };
    group: { slug: string } | string;
    membership_type: string;
    created_at: string;
};

const ROLE_MAP: Record<string, "member" | "leader"> = {
    MEMBER: "member",
    LEADER: "leader",
};

const main = async () => {
    const memberships = (await Bun.file(
        `${import.meta.dir}/data/lepton-memberships.json`,
    ).json()) as Record<string, LeptonMembership[]>;

    const { users } = (await Bun.file(
        `${import.meta.dir}/data/lepton-users.json`,
    ).json()) as { users: { user_id: string; email: string }[] };

    // lepton user_id -> email, from the same export the user import ran on.
    const emailByLeptonId = new Map(
        users.map((u) => [u.user_id, u.email.trim().toLowerCase()]),
    );

    const db = createDb({
        connectionString,
        timeouts: DISABLED_TIMEOUTS,
    });

    const photonUsers = await db
        .select({ id: schema.user.id, email: schema.user.email })
        .from(schema.user);
    const userIdByEmail = new Map(
        photonUsers.map((u) => [u.email.trim().toLowerCase(), u.id]),
    );

    const knownGroups = new Set(
        (await db.select({ slug: schema.group.slug }).from(schema.group)).map(
            (g) => g.slug,
        ),
    );

    // Existing rows, so an already-imported membership can have its join date
    // corrected instead of being silently skipped.
    const existing = new Map(
        (
            await db
                .select({
                    userId: schema.groupMembership.userId,
                    groupSlug: schema.groupMembership.groupSlug,
                    createdAt: schema.groupMembership.createdAt,
                })
                .from(schema.groupMembership)
        ).map((m) => [`${m.userId} ${m.groupSlug}`, m.createdAt]),
    );

    const rows: (typeof schema.groupMembership.$inferInsert)[] = [];
    const corrections: {
        userId: string;
        groupSlug: string;
        createdAt: Date;
    }[] = [];
    let unknownUser = 0;
    let unknownGroup = 0;
    let unknownRole = 0;
    let missingJoinDate = 0;

    for (const [leptonSlug, list] of Object.entries(memberships)) {
        // Lepton's slug is not always Photon's — `kontkom` is `kok` here.
        // The main migration also excludes `tihlde`, but prod does carry that
        // group with 1672 real memberships, and this script only ever corrects
        // rows that already exist. Photon's own group list is the authority,
        // so an excluded slug falls back to itself rather than being dropped.
        const slug = resolveGroupSlug(leptonSlug) ?? leptonSlug;
        if (!knownGroups.has(slug)) {
            if (list.length > 0) {
                unknownGroup += list.length;
                console.warn(`  gruppe finnes ikke i Photon: ${leptonSlug}`);
            }
            continue;
        }

        for (const m of list) {
            const email =
                emailByLeptonId.get(m.user.user_id) ??
                m.user.email?.trim().toLowerCase();
            const userId = email ? userIdByEmail.get(email) : undefined;
            if (!userId) {
                unknownUser++;
                console.warn(
                    `  medlem uten Photon-bruker: ${m.user.user_id} i ${slug}`,
                );
                continue;
            }

            const role = ROLE_MAP[m.membership_type];
            if (!role) {
                unknownRole++;
                console.warn(
                    `  ukjent membership_type ${m.membership_type} for ${m.user.user_id} i ${slug}`,
                );
                continue;
            }

            const joined = m.created_at ? new Date(m.created_at) : null;
            const joinedAt =
                joined && !Number.isNaN(joined.getTime()) ? joined : null;
            if (!joinedAt) {
                missingJoinDate++;
            }

            const current = existing.get(`${userId} ${slug}`);
            if (current) {
                // Only ever move the date backwards — see the file header.
                if (joinedAt && joinedAt < current) {
                    corrections.push({
                        userId,
                        groupSlug: slug,
                        createdAt: joinedAt,
                    });
                }
                continue;
            }

            rows.push({
                userId,
                groupSlug: slug,
                role,
                ...(joinedAt ? { createdAt: joinedAt } : {}),
            });
        }
    }

    console.log(`${rows.length} medlemskap klare til innsetting`);
    console.log(
        `${corrections.length} medlemskap får korrigert «medlem siden»`,
    );

    let inserted = 0;
    let corrected = 0;
    if (commit && rows.length > 0) {
        for (let i = 0; i < rows.length; i += 500) {
            const batch = rows.slice(i, i + 500);
            const result = await db
                .insert(schema.groupMembership)
                .values(batch)
                .onConflictDoNothing()
                .returning({ userId: schema.groupMembership.userId });
            inserted += result.length;
        }
    }

    if (commit && corrections.length > 0) {
        for (const c of corrections) {
            await db
                .update(schema.groupMembership)
                .set({ createdAt: c.createdAt })
                .where(
                    and(
                        eq(schema.groupMembership.userId, c.userId),
                        eq(schema.groupMembership.groupSlug, c.groupSlug),
                    ),
                );
            corrected++;
        }
    }

    console.log();
    console.log(commit ? "=== KJØRT ===" : "=== TØRRKJØRING (read-only) ===");
    console.log(`klare:            ${rows.length}`);
    console.log(
        commit
            ? `satt inn:         ${inserted}`
            : "satt inn:         0 (tørrkjøring)",
    );
    console.log(
        commit
            ? `dato korrigert:   ${corrected}`
            : `dato korrigert:   0 (tørrkjøring, ${corrections.length} klare)`,
    );
    console.log(`bruker mangler:   ${unknownUser}`);
    console.log(`gruppe mangler:   ${unknownGroup}`);
    console.log(`ukjent rolle:     ${unknownRole}`);
    console.log(`uten dato:        ${missingJoinDate}`);
};

await main();
process.exit(0);
