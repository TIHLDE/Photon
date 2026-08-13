/**
 * Backfills `org_group.subtype` from Lepton's group list.
 *
 * Lepton splits its interest groups into "GRUPPE" and "IDRETTSGRUPPE" via a
 * `subtype` column that Photon never modelled. The organisation chart renders
 * the two as separate sections, so the distinction is real information — and
 * it exists nowhere except Lepton, which is being decommissioned. This copies
 * it over before that happens.
 *
 * Reads `/groups/` straight from Lepton's public API rather than the migration
 * export endpoints: the group list is public, so no token is needed, and the
 * export endpoints are being removed in TIHLDE/Lepton#1003.
 *
 * Only ever fills a subtype that is currently null, and only for groups Photon
 * already has — it never renames a group, never creates one, and never
 * overwrites a subtype set by hand in Photon afterwards. Idempotent: a settled
 * re-run reports zero updates.
 *
 * Usage: DATABASE_URL=... bun backfill-group-subtypes.ts [--commit]
 */
import { DISABLED_TIMEOUTS, createDb, schema } from "@photon/db";
import { and, eq, isNull } from "drizzle-orm";

const commit = process.argv.includes("--commit");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("DATABASE_URL må være satt");
    process.exit(1);
}

const BASE = process.env.LEPTON_API ?? "https://api.tihlde.org";

type LeptonGroup = {
    slug: string;
    type: string;
    subtype: string | null;
};

const main = async () => {
    const res = await fetch(`${BASE}/groups/`, {
        headers: { "User-Agent": "photon-subtype-backfill/1.0 (TIHLDE)" },
    });
    if (!res.ok) {
        console.error(`Lepton svarte ${res.status}`);
        process.exit(1);
    }

    const body = (await res.json()) as
        | LeptonGroup[]
        | { results: LeptonGroup[] };
    const groups = Array.isArray(body) ? body : body.results;

    const withSubtype = groups.filter((g) => g.subtype);
    console.log(
        `${groups.length} grupper i Lepton, ${withSubtype.length} med subtype\n`,
    );

    const db = createDb({
        connectionString,
        timeouts: DISABLED_TIMEOUTS,
    });

    let updated = 0;
    let alreadySet = 0;
    let missing = 0;

    for (const g of withSubtype) {
        const existing = await db.query.group.findFirst({
            where: eq(schema.group.slug, g.slug),
            columns: { slug: true, subtype: true },
        });

        if (!existing) {
            missing++;
            console.log(`  finnes ikke i Photon: ${g.slug}`);
            continue;
        }
        if (existing.subtype) {
            alreadySet++;
            continue;
        }

        console.log(`  ${g.slug} -> ${g.subtype}`);
        if (commit) {
            // The isNull guard makes the write itself idempotent, so a
            // concurrent run cannot clobber a value set between the read above
            // and this update.
            await db
                .update(schema.group)
                .set({ subtype: g.subtype })
                .where(
                    and(
                        eq(schema.group.slug, g.slug),
                        isNull(schema.group.subtype),
                    ),
                );
        }
        updated++;
    }

    console.log();
    console.log(commit ? "=== KJØRT ===" : "=== TØRRKJØRING (read-only) ===");
    console.log(commit ? `satt: ${updated}` : `ville satt: ${updated}`);
    console.log(`allerede satt:      ${alreadySet}`);
    if (missing) console.log(`mangler i Photon:   ${missing}`);
};

await main();
process.exit(0);
