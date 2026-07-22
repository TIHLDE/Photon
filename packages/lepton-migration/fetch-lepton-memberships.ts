/**
 * Fetches every group's memberships from Lepton into a local JSON cache.
 *
 * Walks the groups already imported into Photon and pulls
 * `/groups/<slug>/memberships/` for each, paginated. Requires the same
 * superuser token as the user export, read from LEPTON_TOKEN and sent as
 * X-Csrf-Token — never on the command line.
 *
 * Usage: LEPTON_TOKEN=$(cat ...) bun fetch-lepton-memberships.ts
 */
const BASE = process.env.LEPTON_API ?? "https://api.tihlde.org";
const TOKEN = process.env.LEPTON_TOKEN;
const DELAY_MS = 120;

if (!TOKEN) {
    console.error("LEPTON_TOKEN må være satt");
    process.exit(1);
}

type LeptonMembership = {
    user: { user_id: string; email: string };
    group: { slug: string } | string;
    membership_type: string;
    created_at: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const get = async (path: string) => {
    const res = await fetch(`${BASE}${path}`, {
        headers: {
            "X-Csrf-Token": TOKEN,
            "User-Agent": "photon-membership-import/1.0 (TIHLDE)",
        },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        throw new Error(`${path} -> ${res.status}`);
    }
    return (await res.json()) as {
        count: number;
        next: number | null;
        results: LeptonMembership[];
    };
};

const main = async () => {
    const groups = (await Bun.file(
        `${import.meta.dir}/../../packages/lepton-migration/data/lepton-groups.json`,
    )
        .json()
        .catch(() => null)) as { slug: string }[] | null;

    // The group list is small and public — fetch it fresh rather than
    // depending on an older cache existing.
    let slugs: string[];
    if (groups) {
        slugs = groups.map((g) => g.slug);
    } else {
        // /groups/ returns a plain array, not a paginated envelope.
        const res = await fetch(`${BASE}/groups/`, {
            headers: { "User-Agent": "photon-membership-import/1.0" },
        });
        if (!res.ok) {
            throw new Error(`/groups/ -> ${res.status}`);
        }
        const data = (await res.json()) as
            | { slug: string }[]
            | { results: { slug: string }[] };
        slugs = (Array.isArray(data) ? data : data.results).map((g) => g.slug);
    }

    console.log(`${slugs.length} grupper å hente medlemskap for`);

    const memberships: Record<string, LeptonMembership[]> = {};
    let total = 0;

    for (const slug of slugs) {
        const rows: LeptonMembership[] = [];
        let page = 1;
        while (true) {
            const data = await get(
                `/groups/${slug}/memberships/?page=${page}`,
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
        memberships[slug] = rows;
        total += rows.length;
        if (rows.length > 0) console.log(`  ${slug}: ${rows.length}`);
        await sleep(DELAY_MS);
    }

    const out = `${import.meta.dir}/data/lepton-memberships.json`;
    await Bun.write(out, JSON.stringify(memberships, null, 2));
    console.log(`\n${total} medlemskap i ${slugs.length} grupper → ${out}`);
};

await main();
process.exit(0);
