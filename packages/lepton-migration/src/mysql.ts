/**
 * Data source for the migration phases.
 *
 * Two modes behind the same `query()` interface:
 *
 * - A real MySQL connection (mysql2/promise), when a `mysql://` url is given.
 * - A JSON directory (`json:<dir>`), holding one `<table>.json` per table as
 *   fetched by `fetch-lepton-tables.ts` from Lepton's superuser-gated export
 *   endpoint. Photon has no access to Lepton's database in production, so
 *   this is the mode the real migration runs in.
 *
 * The phases only ever run `SELECT * FROM <table>` (plus one column
 * projection), so JSON mode resolves the table name from the FROM clause and
 * returns the cached rows. Timestamps arrive as ISO-8601 strings and are
 * revived to Date objects, matching what mysql2 returns with
 * `dateStrings: false`; naive datetimes are UTC (Django stores UTC), so a
 * missing offset gets a Z rather than being read in local time.
 */
import mysql from "mysql2/promise";

let connection: mysql.Connection | null = null;
let tablesDir: string | null = null;

const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HAS_OFFSET_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/;

function reviveDates(row: Record<string, unknown>): Record<string, unknown> {
    for (const [key, value] of Object.entries(row)) {
        if (typeof value !== "string") continue;
        if (DATETIME_PATTERN.test(value)) {
            row[key] = new Date(
                HAS_OFFSET_PATTERN.test(value) ? value : `${value}Z`,
            );
        } else if (DATE_PATTERN.test(value)) {
            row[key] = new Date(`${value}T00:00:00Z`);
        }
    }
    return row;
}

export async function connectMySQL(url: string): Promise<void> {
    if (url.startsWith("json:")) {
        tablesDir = url.slice("json:".length);
        console.log(`Reading Lepton tables from ${tablesDir} (JSON export)`);
        return;
    }

    connection = await mysql.createConnection({
        uri: url,
        timezone: "+00:00",
        dateStrings: false,
    });
    console.log("Connected to MySQL (Lepton)");
}

export async function query<T = Record<string, unknown>>(
    sql: string,
): Promise<T[]> {
    if (tablesDir) {
        const table = sql.match(/FROM\s+([a-z_]+)/i)?.[1];
        if (!table) {
            throw new Error(`JSON mode cannot resolve a table from: ${sql}`);
        }
        const file = Bun.file(`${tablesDir}/${table}.json`);
        if (!(await file.exists())) {
            throw new Error(
                `${tablesDir}/${table}.json missing — run fetch-lepton-tables.ts first`,
            );
        }
        const rows = (await file.json()) as Record<string, unknown>[];
        // verify.ts counts via `SELECT COUNT(*) as cnt` — serve the length
        // rather than the rows so its old-side numbers stay meaningful.
        if (/SELECT\s+COUNT\(\*\)/i.test(sql)) {
            return [{ cnt: rows.length }] as T[];
        }
        return rows.map(reviveDates) as T[];
    }

    const [rows] = await connection!.query(sql);
    return rows as T[];
}

export async function closeMySQL(): Promise<void> {
    if (connection) {
        await connection.end();
        console.log("MySQL connection closed");
    }
}
