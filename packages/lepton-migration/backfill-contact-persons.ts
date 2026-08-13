/**
 * Attaches contact persons to the events imported ahead of the full migration.
 *
 * `import-upcoming.ts` pulled TIHLDE's upcoming events from Lepton's public
 * REST API so there was content to build against. That API exposes each event's
 * contact person, but no Photon user existed to point at, so
 * `contact_person_id` was left null and the Lepton `user_id` was recorded in
 * `data/imported-events.json` instead.
 *
 * Once the MySQL migration has run, those users exist — `01-users.ts` stores
 * each Lepton `user_id` as the Photon user's `username`. This joins the two
 * back together.
 *
 * Safe to run more than once: it only fills rows where contact_person_id is
 * still null, and reports anything it could not match.
 *
 * Usage: DATABASE_URL=... bun backfill-contact-persons.ts [--commit]
 * Without --commit it reports what it would change and rolls back.
 */
import { DISABLED_TIMEOUTS, createDb, schema } from "@photon/db";
import { and, eq, isNull } from "drizzle-orm";

const commit = process.argv.includes("--commit");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("DATABASE_URL må være satt");
    process.exit(1);
}

type Manifest = {
    slugs: string[];
    contactPersons: Record<string, string>;
};

const main = async () => {
    const manifest: Manifest = await Bun.file(
        `${import.meta.dir}/data/imported-events.json`,
    ).json();

    const entries = Object.entries(manifest.contactPersons);
    console.log(`${entries.length} kontaktpersoner å koble\n`);

    const db = createDb({
        connectionString,
        timeouts: DISABLED_TIMEOUTS,
    });

    let matched = 0;
    const missingUser: string[] = [];
    const missingEvent: string[] = [];
    const alreadySet: string[] = [];

    await db
        .transaction(async (tx) => {
            for (const [slug, username] of entries) {
                const [user] = await tx
                    .select({ id: schema.user.id })
                    .from(schema.user)
                    .where(eq(schema.user.username, username))
                    .limit(1);

                if (!user) {
                    missingUser.push(`${slug} (${username})`);
                    continue;
                }

                const updated = await tx
                    .update(schema.event)
                    .set({ contactPersonId: user.id })
                    .where(
                        and(
                            eq(schema.event.slug, slug),
                            isNull(schema.event.contactPersonId),
                        ),
                    )
                    .returning({ slug: schema.event.slug });

                if (updated.length > 0) {
                    matched++;
                    continue;
                }

                // Either the event is gone or someone already set a contact.
                const [existing] = await tx
                    .select({ id: schema.event.id })
                    .from(schema.event)
                    .where(eq(schema.event.slug, slug))
                    .limit(1);

                if (existing) alreadySet.push(slug);
                else missingEvent.push(slug);
            }

            if (!commit) {
                console.log("(tørrkjøring — ruller tilbake)\n");
                tx.rollback();
            }
        })
        .catch((err) => {
            if (err?.constructor?.name !== "TransactionRollbackError")
                throw err;
        });

    console.log(`koblet:            ${matched}`);
    console.log(`allerede satt:     ${alreadySet.length}`);
    console.log(`bruker ikke funnet:${missingUser.length}`);
    console.log(`event ikke funnet: ${missingEvent.length}`);

    if (missingUser.length > 0) {
        console.log(
            "\nBrukere som mangler (kjør brukermigreringen først?):",
            missingUser.slice(0, 10).join(", "),
        );
    }
    if (missingEvent.length > 0) {
        console.log(
            "\nArrangementer som mangler (slettet, eller migreringen skrev dem på nytt):",
            missingEvent.slice(0, 10).join(", "),
        );
    }
};

await main();
process.exit(0);
