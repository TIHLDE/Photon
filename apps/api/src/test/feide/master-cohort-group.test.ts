import {
    applyFeideStudyPrograms,
    parseValidStudyPrograms,
    partitionByCampus,
    resolveCampus,
} from "@photon/auth/feide";
import { type DbSchema, schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * A master's intake never becomes a cohort group.
 *
 * Cohort groups are programme-less: they are slugged as a bare year and say
 * nothing about which studies started then, and 167 of the inherited priority
 * pools select on them. Putting a master's intake in one therefore mixes
 * master students into the pools aimed at that year's *bachelor* intake.
 *
 * The master's start year lives on the programme row instead. These tests pin
 * both halves of that: the year is still recorded, and the bachelor cohort the
 * member already carries is left standing as history.
 */

const kull = (code: string, year: string) => ({
    id: `fc:fs:fs:kull:ntnu.no:${code}:${year}`,
    type: "fc:fs:kull",
    displayName: `Kull for Høst ${year.slice(0, 4)} ${code}`,
    membership: { active: true },
});

const prg = (code: string) => ({
    id: `fc:fs:fs:prg:ntnu.no:${code}`,
    type: "fc:fs:prg",
    displayName: code,
    membership: { active: true },
});

const emne = (code: string) => ({
    id: `fc:fs:fs:emne:ntnu.no:${code}:1`,
    type: "fc:fs:emne",
    displayName: code,
    membership: { active: true },
});

/** Trondheim course codes, so the campus gate lets the member through. */
const trondheimCourses = ["INGT1002", "IMAT1002", "IDATT1003"];

const DURING_INTAKE = new Date("2026-08-15T12:00:00Z");

type FeideGroups = Parameters<typeof parseValidStudyPrograms>[0];

const seedProgrammes = async (db: NodePgDatabase<DbSchema>) => {
    await db
        .insert(schema.group)
        .values([
            {
                slug: "dataingenior",
                name: "Dataingeniør",
                type: "STUDY",
                finesInfo: "",
                finesActivated: false,
            },
            {
                slug: "digital-samhandling",
                name: "Digital transformasjon",
                type: "STUDY",
                finesInfo: "",
                finesActivated: false,
            },
        ])
        .onConflictDoNothing();

    await db
        .insert(schema.studyProgram)
        .values([
            {
                slug: "dataingenior",
                feideCode: "BIDATA",
                displayName: "Dataingeniør",
                type: "bachelor",
            },
            {
                slug: "digital-samhandling",
                feideCode: "ITMAIKTSA",
                displayName: "Digital Samhandling",
                type: "master",
            },
        ])
        .onConflictDoNothing();

    await db
        .insert(schema.role)
        .values([{ name: "member" }, { name: "alumni" }])
        .onConflictDoNothing();
};

const signInWithFeide = async (
    db: NodePgDatabase<DbSchema>,
    userId: string,
    groups: FeideGroups,
    now = DURING_INTAKE,
) => {
    const campus = resolveCampus(groups);
    const { allowed, campusRejected } = partitionByCampus(
        parseValidStudyPrograms(groups),
        campus,
    );

    await applyFeideStudyPrograms(
        db,
        userId,
        allowed,
        campusRejected,
        campus,
        null,
        now,
    );
};

const cohortGroupsOf = async (db: NodePgDatabase<DbSchema>, userId: string) => {
    const rows = await db
        .select({ slug: schema.groupMembership.groupSlug })
        .from(schema.groupMembership)
        .where(eq(schema.groupMembership.userId, userId));

    return rows
        .map((r) => r.slug)
        .filter((slug) => /^\d{4}$/.test(slug))
        .sort();
};

const studyGroupsOf = async (db: NodePgDatabase<DbSchema>, userId: string) => {
    const rows = await db
        .select({ slug: schema.groupMembership.groupSlug })
        .from(schema.groupMembership)
        .innerJoin(
            schema.group,
            eq(schema.group.slug, schema.groupMembership.groupSlug),
        )
        .where(
            and(
                eq(schema.groupMembership.userId, userId),
                eq(schema.group.type, "STUDY"),
            ),
        );

    return rows.map((r) => r.slug).sort();
};

const membershipFor = async (
    db: NodePgDatabase<DbSchema>,
    userId: string,
    feideCode: string,
) => {
    const [row] = await db
        .select({
            startYear: schema.studyProgramMembership.startYear,
            source: schema.studyProgramMembership.startYearSource,
        })
        .from(schema.studyProgramMembership)
        .innerJoin(
            schema.studyProgram,
            eq(
                schema.studyProgram.id,
                schema.studyProgramMembership.studyProgramId,
            ),
        )
        .where(
            and(
                eq(schema.studyProgramMembership.userId, userId),
                eq(schema.studyProgram.feideCode, feideCode),
            ),
        )
        .limit(1);

    return row;
};

describe("a master's intake", () => {
    integrationTest(
        "is recorded on the programme row, never as a cohort group",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();

            /**
             * NTNU has never handed this service a `fc:fs:kull` for
             * ITMAIKTSA — 0 of 37 rows in production — but the rule must not
             * depend on that. Supply one, so the test pins "no cohort group
             * for a master" rather than "no year for a master".
             */
            await signInWithFeide(ctx.db, user.id, [
                prg("ITMAIKTSA"),
                kull("ITMAIKTSA", "2026H"),
                ...trondheimCourses.map(emne),
            ]);

            expect(await membershipFor(ctx.db, user.id, "ITMAIKTSA")).toEqual({
                startYear: 2026,
                source: "feide",
            });

            // The study group is still mirrored — only the cohort is withheld.
            expect(await studyGroupsOf(ctx.db, user.id)).toEqual([
                "digital-samhandling",
            ]);
            expect(await cohortGroupsOf(ctx.db, user.id)).toEqual([]);
        },
    );

    integrationTest(
        "leaves the bachelor cohort standing when a member continues onto a master",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();

            // Third year of the bachelor: cohort 2023, group created as usual.
            await signInWithFeide(
                ctx.db,
                user.id,
                [
                    prg("BIDATA"),
                    kull("BIDATA", "2023H"),
                    ...trondheimCourses.map(emne),
                ],
                new Date("2025-09-01T12:00:00Z"),
            );

            expect(await cohortGroupsOf(ctx.db, user.id)).toEqual(["2023"]);

            /**
             * Continues onto the master. Its own cohort is supplied here on
             * purpose: without it the master's year would be null anyway, and
             * the assertion below would hold whether or not the rule exists.
             */
            await signInWithFeide(ctx.db, user.id, [
                prg("BIDATA"),
                kull("BIDATA", "2023H"),
                prg("ITMAIKTSA"),
                kull("ITMAIKTSA", "2026H"),
                ...trondheimCourses.map(emne),
            ]);

            /**
             * The bachelor cohort is the member's real intake and the only
             * thing standing between them and every pool aimed at 2023. A
             * master row must never take it with it.
             */
            expect(await cohortGroupsOf(ctx.db, user.id)).toEqual(["2023"]);
            expect(await studyGroupsOf(ctx.db, user.id)).toEqual([
                "dataingenior",
                "digital-samhandling",
            ]);
        },
    );
});
