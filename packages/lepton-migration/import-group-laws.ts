/**
 * Imports every group's lovverk (fine laws) from Lepton into Photon.
 *
 * `group_law` was never part of the table-export allowlist, but Lepton's
 * regular API exposes `GET /groups/{slug}/laws/` and the superuser token
 * passes its admin read check — so this reads the laws for every group that
 * exists in Photon and inserts them into `org_group_law` keeping Lepton's
 * law ids.
 *
 * Idempotent: inserts use onConflictDoNothing on the id, so a re-run only
 * adds laws that are missing.
 *
 * Usage:
 *   LEPTON_TOKEN=$(cat .lepton-token) DATABASE_URL=... \
 *   bun import-group-laws.ts [--commit]
 */
import { createDb, schema } from "@photon/db";
import { char32ToUuid } from "./src/mappings";

const commit = process.argv.includes("--commit");
const BASE = process.env.LEPTON_API ?? "https://api.tihlde.org";

const need = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        console.error(`${name} må være satt`);
        process.exit(1);
    }
    return value;
};

const TOKEN = need("LEPTON_TOKEN");
const connectionString = need("DATABASE_URL");

type LeptonLaw = {
    id: string;
    description: string;
    paragraph: string | number;
    title: string;
    amount: number;
};

/**
 * Lepton paginates as {count, next, previous, results} where `next` is a
 * page NUMBER (see fetch-lepton-memberships.ts) — loop on ?page=N.
 */
async function fetchLaws(slug: string): Promise<LeptonLaw[] | null> {
    const laws: LeptonLaw[] = [];
    let page = 1;

    while (true) {
        const res = await fetch(
            `${BASE}/groups/${encodeURIComponent(slug)}/laws/?page=${page}`,
            {
                headers: {
                    "X-Csrf-Token": TOKEN,
                    "User-Agent": "photon-law-import/1.0 (TIHLDE)",
                },
            },
        );
        if (res.status === 404) return null;
        if (!res.ok) {
            const body = await res.text();
            console.error(
                `Lepton svarte ${res.status} for ${slug}: ${body.slice(0, 200)}`,
            );
            process.exit(1);
        }
        const data = (await res.json()) as
            | LeptonLaw[]
            | { next: number | null; results: LeptonLaw[] };
        if (Array.isArray(data)) {
            laws.push(...data);
            break;
        }
        laws.push(...data.results);
        if (!data.next) break;
        page++;
    }
    return laws;
}

const normalizeId = (id: string): string =>
    id.includes("-") ? id : char32ToUuid(id);

const main = async () => {
    const db = createDb({ connectionString });

    const groups = await db
        .select({ slug: schema.group.slug })
        .from(schema.group);
    console.log(`Grupper i Photon: ${groups.length}`);

    const existing = await db
        .select({ id: schema.groupLaw.id })
        .from(schema.groupLaw);
    const existingIds = new Set(existing.map((l) => l.id));
    console.log(`Lover i Photon fra før: ${existingIds.size}`);

    type Row = typeof schema.groupLaw.$inferInsert;
    const toInsert: Row[] = [];
    let total = 0;
    let missingGroups = 0;

    for (const g of groups) {
        const laws = await fetchLaws(g.slug);
        if (laws === null) {
            missingGroups++;
            continue;
        }
        if (laws.length === 0) continue;

        total += laws.length;
        const fresh = laws.filter((l) => !existingIds.has(normalizeId(l.id)));
        console.log(`  ${g.slug}: ${laws.length} lover (${fresh.length} nye)`);

        for (const l of fresh) {
            toInsert.push({
                id: normalizeId(l.id),
                groupSlug: g.slug,
                paragraph: Number(l.paragraph).toFixed(2),
                title: l.title.slice(0, 100),
                description: l.description ?? "",
                amount: l.amount ?? 1,
            });
        }
    }

    console.log();
    console.log(`Lover i Lepton totalt:    ${total}`);
    console.log(`Grupper uten Lepton-side: ${missingGroups}`);
    console.log(`Skal settes inn:          ${toInsert.length}`);

    if (!commit) {
        console.log("\n=== TØRRKJØRING (read-only) — kjør med --commit ===");
        return;
    }

    if (toInsert.length > 0) {
        await db.insert(schema.groupLaw).values(toInsert).onConflictDoNothing();
    }
    console.log(`\n=== KJØRT === satte inn ${toInsert.length} lover`);
};

await main();
process.exit(0);
