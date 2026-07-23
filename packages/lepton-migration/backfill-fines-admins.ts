/**
 * Backfills group fines admins (botsjefer) that the original migration lost.
 *
 * The prod groups were seeded before the data migration ran, so phase 2's
 * `onConflictDoNothing` insert never touched them and `fines_admin_id`
 * stayed null. This reads the `group_group` export (fetched with
 * `fetch-lepton-tables.ts group_group`), resolves Lepton's `fines_admin_id`
 * (a username) to the Photon user via `user.username`, and sets
 * `org_group.fines_admin_id`.
 *
 * Idempotent: groups that already have the right admin are skipped; a group
 * whose admin differs from Lepton's is reported but NOT overwritten unless
 * --force is given (someone may have set it in Photon already).
 *
 * Usage:
 *   LEPTON_TOKEN=$(cat .lepton-token) bun fetch-lepton-tables.ts group_group
 *   DATABASE_URL=... bun backfill-fines-admins.ts [--commit] [--force]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDb, schema } from "@photon/db";
import { eq, inArray, isNotNull } from "drizzle-orm";
import { resolveGroupSlug } from "./src/mappings";

const commit = process.argv.includes("--commit");
const force = process.argv.includes("--force");
const TABLES_DIR = process.env.LEPTON_TABLES_DIR ?? "data/tables";

const need = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        console.error(`${name} må være satt`);
        process.exit(1);
    }
    return value;
};

const connectionString = need("DATABASE_URL");

type LeptonGroupRow = { slug: string; fines_admin_id: string | null };

const main = async () => {
    const db = createDb({ connectionString });

    const raw = readFileSync(join(TABLES_DIR, "group_group.json"), "utf8");
    const leptonGroups = JSON.parse(raw) as LeptonGroupRow[];

    const withAdmin = leptonGroups.filter((g) => g.fines_admin_id);
    console.log(
        `group_group-rader: ${leptonGroups.length}, med botsjef: ${withAdmin.length}`,
    );

    // Resolve Lepton usernames -> Photon user ids
    const usernames = [...new Set(withAdmin.map((g) => g.fines_admin_id!))];
    const users = await db
        .select({ id: schema.user.id, username: schema.user.username })
        .from(schema.user)
        .where(inArray(schema.user.username, usernames));
    const userByUsername = new Map(users.map((u) => [u.username!, u.id]));

    const groups = await db
        .select({
            slug: schema.group.slug,
            finesAdminId: schema.group.finesAdminId,
        })
        .from(schema.group);
    const groupBySlug = new Map(groups.map((g) => [g.slug, g]));

    type Job = { slug: string; userId: string; username: string };
    const jobs: Job[] = [];
    let alreadySet = 0;
    let differs = 0;
    let missingUser = 0;
    let missingGroup = 0;

    for (const g of withAdmin) {
        const slug = resolveGroupSlug(g.slug);
        if (!slug) continue;

        const photonGroup = groupBySlug.get(slug);
        if (!photonGroup) {
            console.warn(`  gruppe finnes ikke i Photon: ${slug}`);
            missingGroup++;
            continue;
        }

        const userId = userByUsername.get(g.fines_admin_id!);
        if (!userId) {
            console.warn(
                `  botsjef "${g.fines_admin_id}" (${slug}) finnes ikke i Photon`,
            );
            missingUser++;
            continue;
        }

        if (photonGroup.finesAdminId === userId) {
            alreadySet++;
            continue;
        }
        if (photonGroup.finesAdminId && !force) {
            console.warn(
                `  ${slug}: har allerede en annen botsjef i Photon — hopper over (bruk --force for å overskrive)`,
            );
            differs++;
            continue;
        }

        jobs.push({ slug, userId, username: g.fines_admin_id! });
    }

    console.log();
    console.log(`skal settes:        ${jobs.length}`);
    for (const j of jobs) console.log(`  ${j.slug} -> ${j.username}`);
    console.log(`allerede riktig:    ${alreadySet}`);
    console.log(`avviker (hoppet):   ${differs}`);
    console.log(`bruker mangler:     ${missingUser}`);
    console.log(`gruppe mangler:     ${missingGroup}`);

    if (!commit) {
        console.log("\n=== TØRRKJØRING (read-only) — kjør med --commit ===");
        return;
    }

    for (const j of jobs) {
        await db
            .update(schema.group)
            .set({ finesAdminId: j.userId })
            .where(eq(schema.group.slug, j.slug));
    }

    const nowSet = await db
        .select({ slug: schema.group.slug })
        .from(schema.group)
        .where(isNotNull(schema.group.finesAdminId));
    console.log(
        `\n=== KJØRT === satte ${jobs.length} botsjefer, ${nowSet.length} grupper har nå botsjef`,
    );
};

await main();
process.exit(0);
