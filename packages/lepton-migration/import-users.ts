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
 */
import { createAuth, drizzleAdapter } from "@photon/auth";
import { createDb, schema } from "@photon/db";
import { ConsoleEmailService } from "@photon/core/services/email";
import { InMemoryCache } from "@photon/core/services/cache";
import { eq } from "drizzle-orm";

const commit = process.argv.includes("--commit");

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

    let created = 0;
    let adopted = 0;
    let failed = 0;

    for (const u of unique) {
        const email = u.email.trim().toLowerCase();
        const match = existingByEmail.get(email);

        if (match) {
            adopted++;
            if (commit && match.username !== u.user_id) {
                await db
                    .update(schema.user)
                    .set({
                        username: u.user_id,
                        displayUsername: u.user_id,
                    })
                    .where(eq(schema.user.id, match.id));
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
                        username: u.user_id,
                        displayUsername: u.user_id,
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
    if (failed) console.log(`FEILET:             ${failed}`);
};

await main();
process.exit(0);
