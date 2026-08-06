/**
 * Imports users from Lepton's export into Photon, ahead of the full migration.
 *
 * Reads the cache written by `fetch-lepton-users.ts` and, for each Lepton user,
 * either adopts an existing Photon account with the same email or creates a new
 * one. The Lepton user_id is stored as `username`, which is how
 * `backfill-contact-persons.ts` and the eventual MySQL migration resolve
 * members back to their rows.
 *
 * Scope is deliberately just the accounts: allergies, bio and settings are left
 * to the full migration, which processes every user (created or adopted) and
 * fills them in with ON CONFLICT DO NOTHING.
 *
 * Idempotent. Without --commit it only reports what it would do (read-only),
 * because better-auth's createUser writes immediately and cannot be wrapped in
 * a rollback. With --commit it creates and adopts.
 *
 * Usage: DATABASE_URL=... [AUTH_SECRET=...] bun import-users.ts [--commit]
 *        [--rename-adopted]
 */
import { createAuth, drizzleAdapter } from "@photon/auth";
import { slugifyText } from "@photon/core/slug";
import { createDb, schema } from "@photon/db";
import { ConsoleEmailService } from "@photon/core/services/email";
import { InMemoryCache } from "@photon/core/services/cache";
import { eq } from "drizzle-orm";

const commit = process.argv.includes("--commit");

/**
 * Rewrite an existing account's username to the one derived from its Lepton
 * id. Off by default.
 *
 * This mattered for the first migration, where the username had to be
 * established as the join key back to Lepton's rows. Re-running the import as
 * a delta is a different job: every adopted account already has its key, so a
 * rename is pure churn at best — and at worst it changes the handle of an
 * active member, or collides with an account that legitimately holds the name.
 */
const renameAdopted = process.argv.includes("--rename-adopted");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("DATABASE_URL må være satt");
    process.exit(1);
}

type LeptonUser = {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    is_superuser: boolean;
};

const main = async () => {
    const { users } = (await Bun.file(
        `${import.meta.dir}/data/lepton-users.json`,
    ).json()) as { users: LeptonUser[] };

    console.log(`${users.length} brukere i eksporten\n`);

    const db = createDb({ connectionString });

    // Only the commit path needs an auth instance: a dry run is read-only.
    // No redis, no queue, no outbound mail — an in-memory cache and a console
    // mailer are enough to create accounts, and nothing here sends email. The
    // secret only signs sessions, which this never creates, so any non-empty
    // value works; it never touches the created rows.
    const auth = commit
        ? createAuth({
              isDevMode: false,
              secret:
                  process.env.AUTH_SECRET ||
                  crypto.randomUUID() + crypto.randomUUID(),
              services: {
                  database: drizzleAdapter(db, { provider: "pg", schema }),
                  db,
                  cache: new InMemoryCache(),
                  email: new ConsoleEmailService(),
              },
              oauth: { pages: { consent: "/consent", login: "/login" } },
              urls: {
                  backend: "https://photon.tihlde.org",
                  frontend: "https://new.tihlde.org",
                  additionalTrusted: [],
                  basePath: "/api/auth",
              },
              DANGEROUSLY_SET_INSECURE_HASHING_ALGORITHM: false,
          })
        : null;

    // Dedupe by email, keeping the first — the same rule the full migration
    // uses, so both agree on which duplicate wins.
    const seen = new Set<string>();
    const unique: LeptonUser[] = [];
    let duplicates = 0;
    for (const u of users) {
        const email = u.email.trim().toLowerCase();
        if (!email) continue;
        if (seen.has(email)) {
            duplicates++;
            continue;
        }
        seen.add(email);
        unique.push(u);
    }

    const existing = await db
        .select({
            id: schema.user.id,
            email: schema.user.email,
            username: schema.user.username,
        })
        .from(schema.user);
    const existingByEmail = new Map(
        existing.map((r) => [r.email.trim().toLowerCase(), r]),
    );

    /**
     * The second way to recognise someone we already have: an exact match on
     * the Lepton user_id.
     *
     * E-mail alone stopped being enough once Fadderuka started creating Lepton
     * accounts. A student makes their account on tihlde.org with
     * `eriknli@stud.ntnu.no`, then signs up for fadderuka with a private
     * address — same NTNU username, two different e-mails, and an
     * e-mail-only import reads the second as a stranger and creates
     * `eriknli.2`. Seven people in the 2026 intake are in exactly that state.
     * A second account is worse than no import: it holds the private address,
     * a username nobody uses, and none of their history.
     *
     * Safe because the id being matched is the raw Lepton one, not the
     * sanitized fallback: `sunnhø` and `sunnho` stay two different keys, so the
     * legacy-duplicate case `uniqueUsername` exists for is untouched.
     */
    const existingByUsername = new Map(
        existing
            .filter((r) => r.username)
            .map((r) => [r.username?.toLowerCase() as string, r]),
    );

    // Usernames must be unique. Seed with what the database already holds so a
    // sanitized legacy id cannot collide with a real one — Sunniva has both a
    // proper `sunnho` account and a legacy `sunnhø` duplicate, and the second
    // must become sunnho.2 rather than fail. Deduplicating the human being is
    // a judgement call left to TIHLDE, not something an import decides.
    const takenUsernames = new Set(
        existing.map((r) => r.username?.toLowerCase()).filter(Boolean),
    );
    const uniqueUsername = (base: string): string => {
        let candidate = base;
        let n = 1;
        while (takenUsernames.has(candidate.toLowerCase())) {
            n += 1;
            candidate = `${base}.${n}`;
        }
        takenUsernames.add(candidate.toLowerCase());
        return candidate;
    };

    /**
     * Better Auth only accepts usernames matching [a-zA-Z0-9_.]{3,}. Seven
     * legacy Lepton ids break that rule — full names with spaces and ø/æ,
     * one-letter ids, hyphens. For them the username cannot be a join key
     * anywhere (the eventual MySQL migration's createUser enforces the same
     * rule), so email carries the identity and the username just has to be
     * valid and unique. Falls back to the email local part when the id itself
     * sanitizes to nothing usable.
     */
    const usernameFor = (u: LeptonUser): string => {
        const id = (u.user_id || "").trim();
        if (/^[a-zA-Z0-9_.]{3,}$/.test(id)) return id;

        const fromId = slugifyText(id).replace(/-/g, ".");
        if (fromId.length >= 3) return fromId;

        const local = u.email.split("@")[0] ?? "";
        const fromEmail = slugifyText(local).replace(/-/g, ".");
        return fromEmail.length >= 3 ? fromEmail : `legacy.${fromId || "user"}`;
    };

    /** True when `username` belongs to some account other than `selfId`. */
    const usernameOwner = new Map(
        existing
            .filter((r) => r.username)
            .map((r) => [r.username?.toLowerCase() as string, r.id]),
    );
    const takenByOther = (username: string, selfId: string): boolean => {
        const owner = usernameOwner.get(username.toLowerCase());
        return owner !== undefined && owner !== selfId;
    };

    let created = 0;
    let adopted = 0;
    let failed = 0;
    let renamed = 0;
    let skippedRenames = 0;
    let collisions = 0;

    for (const u of unique) {
        const email = u.email.trim().toLowerCase();
        const match =
            existingByEmail.get(email) ??
            existingByUsername.get((u.user_id || "").trim().toLowerCase());
        // An adopted account keeps its slot in the taken-set via the seed; a
        // new one must claim a free name.
        const username = match
            ? usernameFor(u)
            : uniqueUsername(usernameFor(u));
        if (username !== u.user_id) {
            console.log(
                `  LEGACY brukernavn ${JSON.stringify(u.user_id)} -> ${username}`,
            );
        }

        if (match) {
            adopted++;
            if (match.username !== username) {
                if (!renameAdopted) {
                    skippedRenames++;
                    console.log(
                        `  BEHOLDER brukernavn ${match.username} (Lepton ville satt ${username})`,
                    );
                } else if (takenByOther(username, match.id)) {
                    // Sunniva has both a real `sunnho` account and a legacy
                    // `sunnhø` duplicate that sanitizes to the same name. The
                    // unique index on username would abort the whole run
                    // mid-import, so refuse the rename and keep going.
                    collisions++;
                    console.log(
                        `  KOLLISJON: ${match.username} -> ${username} er opptatt av en annen konto, hopper over`,
                    );
                } else if (commit) {
                    await db
                        .update(schema.user)
                        .set({
                            username,
                            displayUsername: username,
                        })
                        .where(eq(schema.user.id, match.id));
                    renamed++;
                } else {
                    renamed++; // would rename
                }
            }
            continue;
        }

        if (!commit) {
            created++; // would create
            continue;
        }

        try {
            const placeholder = crypto.randomUUID() + crypto.randomUUID();
            const result = await auth!.api.createUser({
                body: {
                    email: u.email.trim(),
                    password: placeholder,
                    name: `${u.first_name} ${u.last_name}`.trim(),
                    role: u.is_superuser ? "admin" : "user",
                    data: {
                        username,
                        displayUsername: username,
                    },
                },
            });
            if (result?.user?.id) {
                created++;
            } else {
                failed++;
                console.warn(`  createUser ga ingen id: ${u.user_id}`);
            }
        } catch (err) {
            failed++;
            console.warn(`  createUser feilet: ${u.user_id}`, err);
        }

        if ((created + failed) % 100 === 0) {
            console.log(`  ${created} opprettet, ${adopted} adoptert...`);
        }
    }

    console.log();
    console.log(commit ? "=== KJØRT ===" : "=== TØRRKJØRING (read-only) ===");
    console.log(`unike e-poster:     ${unique.length}`);
    console.log(`duplikate e-poster: ${duplicates}`);
    console.log(
        commit ? `opprettet: ${created}` : `ville opprettet: ${created}`,
    );
    console.log(`adoptert (fantes):  ${adopted}`);
    if (renameAdopted) {
        console.log(commit ? `omdøpt: ${renamed}` : `ville omdøpt: ${renamed}`);
        if (collisions)
            console.log(`omdøpinger droppet (navnet opptatt): ${collisions}`);
    } else if (skippedRenames) {
        console.log(
            `brukernavn beholdt: ${skippedRenames} (--rename-adopted for å overskrive)`,
        );
    }
    if (failed) console.log(`FEILET:             ${failed}`);
};

await main();
process.exit(0);
