/**
 * One-shot backfill: give every study-programme row that has no start year one.
 *
 * Around 150 rows in production sit with `start_year = NULL` and a NULL source
 * — 154 when this was written, and the number grows with every login that
 * creates a row the old guard could not fill. They
 * could never be filled: the old conflict guard on the Feide sync only ever let
 * `feide` replace `assumed`, so a row that already existed without a year was
 * stuck there for good. Two programmes are affected above all — NTNU issues no
 * `fc:fs:kull` for ITBAITBEDR or for the master, 0 of 217 rows between them — so
 * for those a year we work out ourselves is the only one there will ever be.
 *
 * Every affected member already has a cohort *group*, so nobody's class year is
 * wrong today. What the backfill buys is that a bachelor's intake and a
 * master's stop being the same number: the group carries the year someone
 * started their bachelor, and reading it for a master is what made a first-year
 * master indistinguishable from a third-year bachelor.
 *
 * Two rules, deliberately different in how much they trust themselves:
 *
 * - **Bachelor rows** take the year straight from the member's own cohort
 *   group. Exact, no inference. Only when there is exactly one: a member who
 *   transferred carries a group per intake, and choosing between them is a
 *   judgement call for a human, not a script. Those rows are left alone.
 * - **Master rows** take it from when we first saw the member on the programme,
 *   via `created_at` on the study-group membership. The cohort group cannot
 *   help here — it belongs to their bachelor. Checked against the 314 rows
 *   where Feide did supply a year: 282 exact, 21 out by one, 7 by more.
 *
 * Both are written as `derived`, the lowest rank, so a real year from Feide or a
 * correction by hand still overrides them.
 *
 * This is stricter than the same derivation at login time, which must produce
 * *something* for a student who has just arrived. A backfill has no such
 * pressure: leaving a row for a human to decide is a valid outcome.
 *
 * Idempotent — only rows with a NULL start year are touched.
 *
 * Run with:
 *   cd apps/api && bun run src/db/backfill-study-start-year.ts          # dry run
 *   cd apps/api && bun run src/db/backfill-study-start-year.ts --apply  # writes
 */
import {
    currentAcademicYear,
    isMasterStudySlug,
} from "@photon/auth/academic-year";
import { DISABLED_TIMEOUTS, createDb, schema } from "@photon/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { env } from "~/lib/env";

type Candidate = {
    userId: string;
    userName: string;
    studyProgramId: number;
    programSlug: string;
    isMaster: boolean;
    cohortYears: number[];
    firstSeen: Date | null;
};

type Resolved =
    | { candidate: Candidate; year: number; via: "kullgruppe" | "created_at" }
    | { candidate: Candidate; year: null; via: "hoppes over"; why: string };

function resolve(candidate: Candidate): Resolved {
    if (candidate.isMaster) {
        if (!candidate.firstSeen) {
            return {
                candidate,
                year: null,
                via: "hoppes over",
                why: "ingen studiegruppe å lese created_at fra",
            };
        }
        return {
            candidate,
            year: currentAcademicYear(candidate.firstSeen),
            via: "created_at",
        };
    }

    if (candidate.cohortYears.length === 1) {
        return {
            candidate,
            year: candidate.cohortYears[0] as number,
            via: "kullgruppe",
        };
    }

    return {
        candidate,
        year: null,
        via: "hoppes over",
        why:
            candidate.cohortYears.length === 0
                ? "ingen kullgruppe"
                : `flere kullgrupper (${candidate.cohortYears.join(", ")})`,
    };
}

async function main() {
    const apply = process.argv.includes("--apply");

    const db = createDb({
        connectionString: env.DATABASE_URL,
        timeouts: DISABLED_TIMEOUTS,
    });

    const rows = await db
        .select({
            userId: schema.studyProgramMembership.userId,
            userName: schema.user.name,
            studyProgramId: schema.studyProgram.id,
            programSlug: schema.studyProgram.slug,
            programType: schema.studyProgram.type,
            firstSeen: schema.groupMembership.createdAt,
        })
        .from(schema.studyProgramMembership)
        .innerJoin(
            schema.studyProgram,
            eq(
                schema.studyProgram.id,
                schema.studyProgramMembership.studyProgramId,
            ),
        )
        .innerJoin(
            schema.user,
            eq(schema.user.id, schema.studyProgramMembership.userId),
        )
        .leftJoin(
            schema.groupMembership,
            and(
                eq(
                    schema.groupMembership.userId,
                    schema.studyProgramMembership.userId,
                ),
                eq(schema.groupMembership.groupSlug, schema.studyProgram.slug),
            ),
        )
        .where(isNull(schema.studyProgramMembership.startYear));

    const cohortRows = await db
        .select({
            userId: schema.groupMembership.userId,
            slug: schema.groupMembership.groupSlug,
        })
        .from(schema.groupMembership)
        .innerJoin(
            schema.group,
            eq(schema.group.slug, schema.groupMembership.groupSlug),
        )
        .where(sql`upper(${schema.group.type}) = 'STUDYYEAR'`);

    const cohortsByUser = new Map<string, number[]>();
    for (const row of cohortRows) {
        const year = Number.parseInt(row.slug, 10);
        if (!Number.isFinite(year)) continue;
        const list = cohortsByUser.get(row.userId) ?? [];
        list.push(year);
        cohortsByUser.set(row.userId, list);
    }

    const resolved = rows.map((row) =>
        resolve({
            userId: row.userId,
            userName: row.userName,
            studyProgramId: row.studyProgramId,
            programSlug: row.programSlug,
            isMaster:
                row.programType === "master" ||
                isMasterStudySlug(row.programSlug),
            cohortYears: (cohortsByUser.get(row.userId) ?? []).sort(),
            firstSeen: row.firstSeen,
        }),
    );

    const writable = resolved.filter(
        (r): r is Extract<Resolved, { year: number }> => r.year !== null,
    );
    const skipped = resolved.filter((r) => r.year === null);

    console.log(
        `${rows.length} rader uten startår. ${writable.length} kan fylles, ${skipped.length} hoppes over.\n`,
    );

    const byProgramme = new Map<string, number>();
    for (const r of writable) {
        const key = `${r.candidate.programSlug} (${r.via})`;
        byProgramme.set(key, (byProgramme.get(key) ?? 0) + 1);
    }
    for (const [key, count] of [...byProgramme].sort()) {
        console.log(`  ${count.toString().padStart(4)}  ${key}`);
    }

    if (skipped.length > 0) {
        console.log("\nHoppes over:");
        for (const r of skipped) {
            if (r.year !== null) continue;
            console.log(
                `  ${r.candidate.userName} — ${r.candidate.programSlug}: ${r.why}`,
            );
        }
    }

    console.log("\nMasterrader i detalj (lista André går gjennom):");
    for (const r of writable) {
        if (!r.candidate.isMaster) continue;
        console.log(
            `  ${r.candidate.userName.padEnd(32)} ${r.year}  ` +
                `(kullgruppe: ${r.candidate.cohortYears.join(", ") || "ingen"})`,
        );
    }

    if (!apply) {
        console.log("\nTørrkjøring — ingenting er skrevet. Kjør med --apply.");
        return;
    }

    let written = 0;
    for (const r of writable) {
        const result = await db
            .update(schema.studyProgramMembership)
            .set({
                startYear: r.year,
                startYearSource: "derived",
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(
                        schema.studyProgramMembership.userId,
                        r.candidate.userId,
                    ),
                    eq(
                        schema.studyProgramMembership.studyProgramId,
                        r.candidate.studyProgramId,
                    ),
                    // Idempotent, and safe against a row someone filled while
                    // this was running: only ever a NULL is replaced.
                    isNull(schema.studyProgramMembership.startYear),
                ),
            )
            .returning({ userId: schema.studyProgramMembership.userId });

        written += result.length;
    }

    console.log(`\nSkrev ${written} rader.`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
