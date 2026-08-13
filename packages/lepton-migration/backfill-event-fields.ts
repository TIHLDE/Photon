/**
 * Backfills the three event fields the schema redesign dropped, after the
 * fact: `image_alt` and `only_allow_prioritized` on events, and per-
 * registration photo consent (`allow_photo`).
 *
 * The full migration ran before these columns existed (they were added in
 * migration 0018), so the rows are right but the fields sit at their
 * defaults. Reads the table dumps fetched by fetch-lepton-tables.ts and
 * matches events by (title, start) — the same identity the migration's
 * adoption uses — and registrations by (event, user).
 *
 * Only rows that deviate from the column defaults are touched, so re-running
 * is a no-op and rows edited in Photon afterwards keep their values.
 *
 *   DATABASE_URL=... bun backfill-event-fields.ts [--commit]
 */
import { DISABLED_TIMEOUTS, createDb, schema } from "@photon/db";
import { and, eq } from "drizzle-orm";

const commit = process.argv.includes("--commit");
const tablesDir = `${import.meta.dir}/data/tables`;

type LeptonEvent = {
    id: number;
    title: string;
    start_date: string;
    image_alt: string | null;
    only_allow_prioritized: number;
};
type LeptonRegistration = {
    event_id: number;
    user_id: string;
    allow_photo: number;
};
type LeptonUser = { user_id: string; email: string };

const asUtc = (value: string): Date =>
    new Date(/Z|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);

const db = createDb({
    connectionString: process.env.DATABASE_URL!,
    timeouts: DISABLED_TIMEOUTS,
});

const leptonEvents = (await Bun.file(
    `${tablesDir}/content_event.json`,
).json()) as LeptonEvent[];
const leptonRegistrations = (await Bun.file(
    `${tablesDir}/content_registration.json`,
).json()) as LeptonRegistration[];
const leptonUsers = (await Bun.file(
    `${tablesDir}/content_user.json`,
).json()) as LeptonUser[];

// lepton event id -> photon event id, by (title, start)
const photonEvents = await db
    .select({
        id: schema.event.id,
        title: schema.event.title,
        start: schema.event.start,
    })
    .from(schema.event);
const photonByTitleStart = new Map(
    photonEvents.map((e) => [`${e.title} ${e.start.getTime()}`, e.id]),
);
const eventIdMap = new Map<number, string>();
for (const e of leptonEvents) {
    const id = photonByTitleStart.get(
        `${e.title.slice(0, 256)} ${asUtc(e.start_date).getTime()}`,
    );
    if (id) eventIdMap.set(e.id, id);
}
console.log(
    `Resolved ${eventIdMap.size} of ${leptonEvents.length} events against Photon`,
);

// lepton user id -> photon user id, by email (usernames were sanitized for
// seven legacy ids, so email is the reliable join key)
const photonUsers = await db
    .select({ id: schema.user.id, email: schema.user.email })
    .from(schema.user);
const photonByEmail = new Map(
    photonUsers.map((u) => [u.email.toLowerCase().trim(), u.id]),
);
const userIdMap = new Map<string, string>();
for (const u of leptonUsers) {
    const id = photonByEmail.get(u.email.toLowerCase().trim());
    if (id) userIdMap.set(u.user_id, id);
}

// --- events: image_alt + only_allow_prioritized ---
let altSet = 0;
let prioritizedSet = 0;
for (const e of leptonEvents) {
    const photonId = eventIdMap.get(e.id);
    if (!photonId) continue;

    const imageAlt = e.image_alt?.slice(0, 255) || null;
    const onlyPrioritized = Boolean(e.only_allow_prioritized);
    if (!imageAlt && !onlyPrioritized) continue;

    if (commit) {
        await db
            .update(schema.event)
            .set({
                ...(imageAlt ? { imageAlt } : {}),
                ...(onlyPrioritized ? { onlyAllowPrioritized: true } : {}),
            })
            .where(eq(schema.event.id, photonId));
    }
    if (imageAlt) altSet++;
    if (onlyPrioritized) prioritizedSet++;
}
console.log(
    `${commit ? "Set" : "Would set"} imageAlt on ${altSet} events, onlyAllowPrioritized on ${prioritizedSet}`,
);

// --- registrations: allow_photo (only the declines — true is the default) ---
let declinesSet = 0;
let declinesUnresolved = 0;
for (const r of leptonRegistrations) {
    if (r.allow_photo) continue;

    const eventId = eventIdMap.get(r.event_id);
    const userId = userIdMap.get(r.user_id);
    if (!eventId || !userId) {
        declinesUnresolved++;
        continue;
    }

    if (commit) {
        const result = await db
            .update(schema.eventRegistration)
            .set({ allowPhoto: false })
            .where(
                and(
                    eq(schema.eventRegistration.eventId, eventId),
                    eq(schema.eventRegistration.userId, userId),
                ),
            )
            .returning({ userId: schema.eventRegistration.userId });
        if (result.length === 0) {
            declinesUnresolved++;
            continue;
        }
    }
    declinesSet++;
}
console.log(
    `${commit ? "Set" : "Would set"} allowPhoto=false on ${declinesSet} registrations` +
        (declinesUnresolved
            ? ` (${declinesUnresolved} unresolved — skipped users or missing rows)`
            : ""),
);

if (!commit) console.log("\nRe-run with --commit to write.");
process.exit(0);
