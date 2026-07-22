/**
 * Fetches every migration table from Lepton into a local JSON cache.
 *
 * Lepton exposes `GET /migration/photon-table-export/` (superuser-gated,
 * paged) because Photon has no direct access to its MySQL database. This
 * pulls each table the migration pipeline reads and caches it under
 * `data/tables/<table>.json` as an array of row objects — the shape
 * `src/mysql.ts` serves back to the phases when LEPTON_TABLES_DIR is set,
 * standing in for a live MySQL connection.
 *
 * The auth token is read from the LEPTON_TOKEN environment variable and sent
 * in the X-Csrf-Token header — never passed on the command line, so it stays
 * out of shell history and process listings.
 *
 * Usage: LEPTON_TOKEN=$(cat path/to/token) bun fetch-lepton-tables.ts [table...]
 */
const BASE = process.env.LEPTON_API ?? "https://api.tihlde.org";
const TOKEN = process.env.LEPTON_TOKEN;
const PAGE_SIZE = 1000;

/** Mirrors ALLOWED_TABLES in Lepton's photon_table_export view. */
const TABLES = [
    "career_jobpost",
    "communication_notification",
    "content_category",
    "content_event",
    "content_event_favorite_users",
    "content_news",
    "content_prioritypool",
    "content_prioritypool_groups",
    "content_registration",
    "content_strike",
    "content_user",
    "django_content_type",
    "emoji_reaction",
    "forms_answer",
    "forms_answer_selected_options",
    "forms_eventform",
    "forms_field",
    "forms_form",
    "forms_groupform",
    "forms_option",
    "forms_submission",
    "group_fine",
    "group_group",
    "group_membership",
    "payment_order",
    "payment_paidevent",
];

if (!TOKEN) {
    console.error(
        "LEPTON_TOKEN må være satt, f.eks. LEPTON_TOKEN=$(cat .lepton-token) bun fetch-lepton-tables.ts",
    );
    process.exit(1);
}

type ExportPage = {
    table: string;
    count: number;
    offset: number;
    limit: number;
    columns: string[];
    rows: unknown[][];
};

async function fetchTable(table: string): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    let offset = 0;
    let total = Infinity;

    while (offset < total) {
        const res = await fetch(
            `${BASE}/migration/photon-table-export/?table=${table}&offset=${offset}&limit=${PAGE_SIZE}`,
            {
                headers: {
                    "X-Csrf-Token": TOKEN!,
                    "User-Agent": "photon-table-import/1.0 (TIHLDE)",
                },
            },
        );

        if (!res.ok) {
            const body = await res.text();
            console.error(
                `Lepton svarte ${res.status} for ${table}: ${body.slice(0, 200)}`,
            );
            if (res.status === 401 || res.status === 403) {
                console.error(
                    "Sjekk at tokenet tilhører en superbruker i HS/Index.",
                );
            }
            process.exit(1);
        }

        const page = (await res.json()) as ExportPage;
        total = page.count;

        for (const row of page.rows) {
            rows.push(
                Object.fromEntries(
                    page.columns.map((column, i) => [column, row[i]]),
                ),
            );
        }

        offset += page.rows.length;
        // A short page before the reported total means rows moved under us —
        // stop rather than looping on a stale count.
        if (page.rows.length < Math.min(PAGE_SIZE, total - page.offset)) break;
    }

    if (rows.length !== total) {
        console.warn(
            `  ${table}: Lepton oppga ${total} rader, fikk ${rows.length}`,
        );
    }
    return rows;
}

const requested = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const targets = requested.length > 0 ? requested : TABLES;

for (const table of targets) {
    if (!TABLES.includes(table)) {
        console.error(`Ukjent tabell: ${table}`);
        process.exit(1);
    }
}

const outDir = `${import.meta.dir}/data/tables`;

for (const table of targets) {
    const rows = await fetchTable(table);
    await Bun.write(`${outDir}/${table}.json`, JSON.stringify(rows));
    console.log(`${table}: ${rows.length} rader → data/tables/${table}.json`);
}

process.exit(0);
