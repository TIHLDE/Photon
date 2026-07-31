/**
 * Imports ended group memberships from Lepton into Photon's
 * `org_group_membership_history` — the "Tidligere medlemmer" section.
 *
 * Reads the cache written by `fetch-lepton-membership-histories.ts` and
 * inserts one row per stint. Users and groups must already be imported; this
 * only draws the historical edges between them.
 *
 * Members are resolved by *email*, not username, for the same reason as
 * `import-memberships.ts`: seven legacy Lepton ids were sanitized during the
 * user import, so the email is the one key guaranteed to agree.
 *
 * Lepton wrote a history row on every role change too, not just on departure,
 * so a good share of these rows belong to people who never left. Those are
 * not filtered here — the list endpoint excludes anyone on the current roster
 * and folds several stints into the most recent one, so the raw history stays
 * intact and the display stays honest.
 *
 * Idempotent: the unique (user, group, ended_at) index mirrors Lepton's own
 * unique_together, so a re-run inserts nothing new.
 *
 * Both dates are written explicitly, as UTC via the driver. Rows captured
 * natively by Photon are stamped by the database clock instead, so if the
 * target database is not in UTC the two sets are offset relative to each
 * other — verify with `show timezone` before committing against prod.
 *
 * Usage: DATABASE_URL=... bun import-membership-histories.ts [--commit]
 */
import { createDb, schema } from "@photon/db";
import { resolveGroupSlug } from "./src/mappings";

const commit = process.argv.includes("--commit");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("DATABASE_URL må være satt");
    process.exit(1);
}

type LeptonMembershipHistory = {
    user: { user_id: string; email: string };
    membership_type: string;
    start_date: string;
    end_date: string;
};

const parseDate = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const main = async () => {
    const histories = (await Bun.file(
        `${import.meta.dir}/data/lepton-membership-histories.json`,
    ).json()) as Record<string, LeptonMembershipHistory[]>;

    const { users } = (await Bun.file(
        `${import.meta.dir}/data/lepton-users.json`,
    ).json()) as { users: { user_id: string; email: string }[] };

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

    const rows: (typeof schema.groupMembershipHistory.$inferInsert)[] = [];
    let unknownUser = 0;
    let unknownGroup = 0;
    let badDates = 0;
    let reversed = 0;

    for (const [leptonSlug, list] of Object.entries(histories)) {
        // Lepton's slug is not always Photon's — `kontkom` is `kok` here.
        // Photon's own group list is the authority, so a slug the main
        // migration excluded falls back to itself rather than being dropped.
        const slug = resolveGroupSlug(leptonSlug) ?? leptonSlug;
        if (!knownGroups.has(slug)) {
            if (list.length > 0) {
                unknownGroup += list.length;
                console.warn(`  gruppe finnes ikke i Photon: ${leptonSlug}`);
            }
            continue;
        }

        for (const h of list) {
            const email =
                emailByLeptonId.get(h.user.user_id) ??
                h.user.email?.trim().toLowerCase();
            const userId = email ? userIdByEmail.get(email) : undefined;
            if (!userId) {
                unknownUser++;
                continue;
            }

            const startedAt = parseDate(h.start_date);
            const endedAt = parseDate(h.end_date);
            // end_date is what the stint is keyed on, so a row without one
            // cannot be deduplicated and is dropped rather than guessed at.
            if (!startedAt || !endedAt) {
                badDates++;
                continue;
            }
            if (startedAt > endedAt) {
                // Lepton has a handful of these from manual admin edits.
                // Kept, but counted — the UI renders the pair as written.
                reversed++;
            }

            rows.push({
                userId,
                groupSlug: slug,
                role: (h.membership_type || "member").toLowerCase(),
                startedAt,
                endedAt,
            });
        }
    }

    console.log(`${rows.length} avsluttede medlemskap klare til innsetting`);

    let inserted = 0;
    if (commit && rows.length > 0) {
        for (let i = 0; i < rows.length; i += 500) {
            const batch = rows.slice(i, i + 500);
            const result = await db
                .insert(schema.groupMembershipHistory)
                .values(batch)
                .onConflictDoNothing()
                .returning({ id: schema.groupMembershipHistory.id });
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
    console.log(`ugyldige datoer:  ${badDates}`);
    console.log(`slutt før start:  ${reversed}`);
};

await main();
process.exit(0);
