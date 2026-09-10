/**
 * Fetches every group's *ended* memberships from Lepton into a local JSON
 * cache — the source for Photon's "Tidligere medlemmer" section.
 *
 * Walks the group list and pulls `/groups/<slug>/membership-histories/` for
 * each, paginated. Unlike the table export this endpoint only requires an
 * ordinary logged-in Lepton user, so no change to Lepton's ALLOWED_TABLES is
 * needed. The token is read from LEPTON_TOKEN and sent as X-Csrf-Token —
 * never on the command line, so it stays out of shell history.
 *
 * Usage: LEPTON_TOKEN=$(cat ...) bun fetch-lepton-membership-histories.ts
 */
const BASE = process.env.LEPTON_API ?? "https://api.tihlde.org";
const TOKEN = process.env.LEPTON_TOKEN;
const DELAY_MS = 120;

if (!TOKEN) {
    console.error("LEPTON_TOKEN må være satt");
    process.exit(1);
}

type LeptonMembershipHistory = {
    id: string;
    user: { user_id: string; email: string };
    group: { slug: string } | string;
    membership_type: string;
    start_date: string;
    end_date: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const get = async (path: string) => {
    const res = await fetch(`${BASE}${path}`, {
        headers: {
            "X-Csrf-Token": TOKEN,
            "User-Agent": "photon-membership-history-import/1.0 (TIHLDE)",
        },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        throw new Error(`${path} -> ${res.status}`);
    }
    return (await res.json()) as {
        count: number;
        next: number | null;
        results: LeptonMembershipHistory[];
    };
};

const main = async () => {
    const cached = (await Bun.file(`${import.meta.dir}/data/lepton-groups.json`)
        .json()
        .catch(() => null)) as { slug: string }[] | null;

    let slugs: string[];
    if (cached) {
        slugs = cached.map((g) => g.slug);
    } else {
        // /groups/ returns a plain array, not a paginated envelope.
        const res = await fetch(`${BASE}/groups/`, {
            headers: { "User-Agent": "photon-membership-history-import/1.0" },
        });
        if (!res.ok) {
            throw new Error(`/groups/ -> ${res.status}`);
        }
        const data = (await res.json()) as
            | { slug: string }[]
            | { results: { slug: string }[] };
        slugs = (Array.isArray(data) ? data : data.results).map((g) => g.slug);
    }

    console.log(`${slugs.length} grupper å hente medlemskapshistorikk for`);

    const histories: Record<string, LeptonMembershipHistory[]> = {};
    let total = 0;

    for (const slug of slugs) {
        const rows: LeptonMembershipHistory[] = [];
        let page = 1;
        while (true) {
            const data = await get(
                `/groups/${slug}/membership-histories/?page=${page}`,
            ).catch((e) => {
                console.warn(`  ${slug}: ${e.message}`);
                return null;
            });
            if (!data) break;
            rows.push(...data.results);
            if (!data.next) break;
            page++;
            await sleep(DELAY_MS);
        }
        histories[slug] = rows;
        total += rows.length;
        if (rows.length > 0) console.log(`  ${slug}: ${rows.length}`);
        await sleep(DELAY_MS);
    }

    const out = `${import.meta.dir}/data/lepton-membership-histories.json`;
    await Bun.write(out, JSON.stringify(histories, null, 2));
    console.log(
        `\n${total} avsluttede medlemskap i ${slugs.length} grupper → ${out}`,
    );
};

await main();
process.exit(0);
