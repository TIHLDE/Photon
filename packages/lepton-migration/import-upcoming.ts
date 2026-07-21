/**
 * Imports TIHLDE's upcoming events from Lepton's public REST API into Photon.
 *
 * A stopgap so there is real content to build against before the full MySQL
 * migration runs. Deliberately narrow:
 *
 *   - only events that have not expired
 *   - no users, registrations, payments, strikes or forms — the public API does
 *     not expose them, and contact_person_id stays null
 *   - ON CONFLICT DO NOTHING everywhere, so re-running changes nothing
 *
 * Slugs come from @photon/core/slug, the same function the API and the MySQL
 * migration use, so the migration's ON CONFLICT (slug) recognises these rows
 * instead of duplicating them.
 *
 * Usage: DATABASE_URL=... bun import-upcoming.ts [--commit]
 * Without --commit it rolls back and only reports what it would have written.
 */
import { buildEventSlugBase, slugifyText } from "@photon/core/slug";
import { createDb, schema } from "@photon/db";

const CACHE = `${import.meta.dir}/../../../import/cache`;
const commit = process.argv.includes("--commit");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("DATABASE_URL må være satt");
    process.exit(1);
}

type LeptonCategory = { id: number; text: string };
type LeptonGroup = {
    name: string;
    slug: string;
    type: string;
    image: string | null;
    description?: string | null;
    contact_email?: string | null;
    fines_activated?: boolean;
};
type LeptonEvent = {
    id: number;
    title: string;
    start_date: string;
    end_date: string;
    location: string | null;
    category: LeptonCategory | null;
    organizer: LeptonGroup | null;
    expired: boolean;
    image: string;
    image_alt: string;
};

const read = async <T>(name: string): Promise<T> =>
    await Bun.file(`${CACHE}/${name}.json`).json();

const asDate = (value: string | null): Date | null =>
    value ? new Date(value) : null;

/** Lepton serialises booleans and numbers as strings on the detail endpoint. */
const asBool = (value: unknown): boolean =>
    value === true || value === "True" || value === "true";
const asNumber = (value: unknown): number | null => {
    if (value == null || value === "None" || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const main = async () => {
    const db = createDb({ connectionString });

    const categories = await read<LeptonCategory[]>("categories");
    const groups = await read<LeptonGroup[]>("groups");
    const groupDetails =
        await read<Record<string, Record<string, unknown>>>("groups_detail");
    const events = await read<LeptonEvent[]>("events");
    const details =
        await read<Record<string, Record<string, unknown>>>("events_detail");

    const upcoming = events.filter((e) => !e.expired);
    console.log(
        `Kilde: ${categories.length} kategorier, ${groups.length} grupper, ${upcoming.length} kommende arrangementer\n`,
    );

    const written: string[] = [];
    /** slug -> Lepton user_id of the contact person, for the later backfill. */
    const contactPersons: Record<string, string> = {};

    await db
        .transaction(async (tx) => {
            // --- categories: an event's category_slug is a required foreign key ---
            const categoryRows = categories.map((c) => ({
                slug: slugifyText(c.text).slice(0, 64),
                label: c.text,
            }));
            categoryRows.push({
                slug: "uncategorized",
                label: "Uncategorized",
            });

            const insertedCategories = await tx
                .insert(schema.eventCategory)
                .values(categoryRows)
                .onConflictDoNothing()
                .returning({ slug: schema.eventCategory.slug });
            console.log(
                `kategorier:    ${insertedCategories.length} nye av ${categoryRows.length}`,
            );

            const categorySlugById = new Map(
                categories.map((c) => [c.id, slugifyText(c.text).slice(0, 64)]),
            );

            // --- groups: organizer_group_slug is nullable, but keeping it is free ---
            // fine_info, description and contact_email only appear on the detail
            // endpoint. 25 of the 58 groups have real fine text; blanking it would
            // silently drop content nobody would notice was missing.
            const groupRows = groups.map((g) => {
                const d = groupDetails[g.slug] ?? {};
                return {
                    name: g.name,
                    slug: g.slug.slice(0, 128),
                    type: g.type,
                    imageUrl: (d.image as string) || g.image || null,
                    description: (d.description as string) || null,
                    contactEmail: (d.contact_email as string) || null,
                    finesInfo: (d.fine_info as string) || "",
                    finesActivated: asBool(d.fines_activated),
                };
            });

            const insertedGroups = await tx
                .insert(schema.group)
                .values(groupRows)
                .onConflictDoNothing()
                .returning({ slug: schema.group.slug });
            console.log(
                `grupper:       ${insertedGroups.length} nye av ${groupRows.length}`,
            );

            const knownGroups = new Set(
                (
                    await tx
                        .select({ slug: schema.group.slug })
                        .from(schema.group)
                ).map((g) => g.slug),
            );

            // --- events ---
            // Only tracks slugs minted in THIS run. Deliberately not seeded from
            // the database: if an already-imported slug were treated as taken, the
            // loop would mint `...-2` instead, ON CONFLICT would not recognise it,
            // and a second run would duplicate every event rather than skip it.
            const usedSlugs = new Set<string>();

            const eventRows = [];
            for (const e of upcoming) {
                const d = details[String(e.id)] ?? {};

                const base = buildEventSlugBase(
                    e.title,
                    new Date(e.start_date),
                );
                let slug = base;
                let attempt = 1;
                while (usedSlugs.has(slug)) {
                    attempt += 1;
                    slug = `${base}-${attempt}`;
                }
                usedSlugs.add(slug);

                const capacity = asNumber(d.limit);
                const price = asNumber(d.price);
                const organizerSlug = e.organizer?.slug ?? null;

                eventRows.push({
                    title: e.title.slice(0, 256),
                    slug: slug.slice(0, 256),
                    description: (d.description as string) || null,
                    categorySlug: e.category
                        ? (categorySlugById.get(e.category.id) ??
                          "uncategorized")
                        : "uncategorized",
                    location: e.location?.slice(0, 256) ?? null,
                    imageUrl: (d.image as string) || e.image || null,
                    capacity: capacity && capacity > 0 ? capacity : null,
                    start: new Date(e.start_date),
                    end: new Date(e.end_date),
                    registrationStart: asDate(
                        (d.start_registration_at as string) ?? null,
                    ),
                    registrationEnd: asDate(
                        (d.end_registration_at as string) ?? null,
                    ),
                    cancellationDeadline: asDate(
                        (d.sign_off_deadline as string) ?? null,
                    ),
                    isRegistrationClosed: asBool(d.closed),
                    isPaidEvent: price != null,
                    requiresSigningUp: asBool(d.sign_up),
                    priceMinor: price != null ? Math.round(price * 100) : null,
                    reactionsAllowed: asBool(d.emojis_allowed),
                    // Left null on purpose: users are not migrated yet.
                    contactPersonId: null,
                    createdByUserId: null,
                    organizerGroupSlug:
                        organizerSlug && knownGroups.has(organizerSlug)
                            ? organizerSlug
                            : null,
                    enforcesPreviousStrikes: asBool(d.can_cause_strikes),
                });
                written.push(slug);

                // The public API gives us the contact person's Lepton user_id, but
                // there is no Photon user to point at yet. Record it so
                // backfill-contact-persons.ts can join it up once the MySQL
                // migration has created the users (it stores user_id as username).
                const contact = d.contact_person as { user_id?: string } | null;
                if (contact?.user_id) contactPersons[slug] = contact.user_id;
            }

            const insertedEvents = await tx
                .insert(schema.event)
                .values(eventRows)
                .onConflictDoNothing()
                .returning({ slug: schema.event.slug });

            console.log(
                `arrangementer: ${insertedEvents.length} nye av ${eventRows.length}`,
            );

            if (!commit) {
                console.log("\n(tørrkjøring — ruller tilbake)");
                tx.rollback();
            }
        })
        .catch((err) => {
            // drizzle unwinds a rolled-back transaction by throwing a sentinel
            if (err?.constructor?.name !== "TransactionRollbackError")
                throw err;
        });

    console.log("\nSlugger som ble skrevet:");
    for (const s of written.slice(0, 8)) console.log(`  ${s}`);
    if (written.length > 8) console.log(`  ... og ${written.length - 8} til`);

    // Written into the repo, not a temp dir: the backfill happens days later,
    // after the user migration, and a file in /tmp would not survive.
    const manifest = `${import.meta.dir}/data/imported-events.json`;
    await Bun.write(
        manifest,
        `${JSON.stringify({ slugs: written, contactPersons }, null, 4)}\n`,
    );
    console.log(
        `\n${written.length} slugger og ${Object.keys(contactPersons).length} kontaktpersoner skrevet til`,
    );
    console.log(`  packages/lepton-migration/data/imported-events.json`);
};

await main();
process.exit(0);
