/**
 * Fetches the user export from Lepton into a local JSON cache.
 *
 * Lepton exposes `GET /migration/photon-user-export/` (superuser-gated) because
 * Photon has no direct access to its database. This pulls that once and caches
 * it, so `import-users.ts` can run and re-run without hitting Lepton again.
 *
 * The auth token is read from the LEPTON_TOKEN environment variable and sent in
 * the X-Csrf-Token header — never passed on the command line, so it stays out
 * of shell history and process listings.
 *
 * Usage: LEPTON_TOKEN=$(cat path/to/token) bun fetch-lepton-users.ts
 */
const BASE = process.env.LEPTON_API ?? "https://api.tihlde.org";
const TOKEN = process.env.LEPTON_TOKEN;

if (!TOKEN) {
    console.error(
        "LEPTON_TOKEN må være satt, f.eks. LEPTON_TOKEN=$(cat .lepton-token) bun fetch-lepton-users.ts",
    );
    process.exit(1);
}

const main = async () => {
    const res = await fetch(`${BASE}/migration/photon-user-export/`, {
        headers: {
            "X-Csrf-Token": TOKEN,
            "User-Agent": "photon-user-import/1.0 (TIHLDE)",
        },
    });

    if (!res.ok) {
        const body = await res.text();
        console.error(`Lepton svarte ${res.status}: ${body.slice(0, 200)}`);
        if (res.status === 401 || res.status === 403) {
            console.error(
                "Sjekk at tokenet tilhører en superbruker i HS/Index.",
            );
        }
        process.exit(1);
    }

    const data = (await res.json()) as { count: number; users: unknown[] };
    const out = `${import.meta.dir}/data/lepton-users.json`;
    await Bun.write(out, JSON.stringify(data, null, 2));

    console.log(`Hentet ${data.count} brukere → ${out}`);
};

await main();
process.exit(0);
