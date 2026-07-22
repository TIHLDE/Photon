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
 * Idempotent: ON CONFLICT DO NOTHING on the (user, group) pair, and a re-run
 * reports zero new rows. Without --commit nothing is written.
 *
 * Usage: DATABASE_URL=... bun import-memberships.ts [--commit]
 */
import { createDb, schema } from "@photon/db";

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

    const db = createDb({ connectionString });

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

    const rows: (typeof schema.groupMembership.$inferInsert)[] = [];
    let unknownUser = 0;
    let unknownGroup = 0;
    let unknownRole = 0;

    for (const [slug, list] of Object.entries(memberships)) {
        if (!knownGroups.has(slug)) {
            if (list.length > 0) {
                unknownGroup += list.length;
                console.warn(`  gruppe finnes ikke i Photon: ${slug}`);
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

            rows.push({ userId, groupSlug: slug, role });
        }
    }

    console.log(`${rows.length} medlemskap klare til innsetting`);

    let inserted = 0;
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

    console.log();
    console.log(commit ? "=== KJØRT ===" : "=== TØRRKJØRING (read-only) ===");
    console.log(`klare:            ${rows.length}`);
    console.log(
        commit
            ? `satt inn:         ${inserted}`
            : "satt inn:         0 (tørrkjøring)",
    );
    console.log(`bruker mangler:   ${unknownUser}`);
    console.log(`gruppe mangler:   ${unknownGroup}`);
    console.log(`ukjent rolle:     ${unknownRole}`);
};

await main();
process.exit(0);
