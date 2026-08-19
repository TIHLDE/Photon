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
 * The private group a study programme runs for its own students.
 *
 * Membership follows enrolment: an active student is enrolled on login
 * whatever their cohort, and someone Feide reports as finished is removed.
 *
 * Removal is the delicate half. `membership.active = false` means finished,
 * quit, on leave, on exchange, or — most often in August — not registered for
 * the term yet, and Feide gives nothing that tells them apart. Three of those
 * people keep their study right. So the flag is only acted on once the member
 * is also past the length of their programme, which is what separates the 26
 * production rows that read as finished from the 4 that read as students.
 */

const GROUP_SLUG = "digitaltransformasjonfaddergruppe";

/**
 * `active` is OR-ed across every group belonging to a programme — a lapsed
 * cohort next to an active programme still means enrolled — so a member who has
 * genuinely finished arrives with both switched off.
 */
const kull = (code: string, year: string, active = true) => ({
    id: `fc:fs:fs:kull:ntnu.no:${code}:${year}`,
    type: "fc:fs:kull",
    displayName: `Kull ${year}`,
    membership: { active },
});

const prg = (code: string, active = true) => ({
    id: `fc:fs:fs:prg:ntnu.no:${code}`,
    type: "fc:fs:prg",
    displayName: code,
    membership: { active },
});

const emne = (code: string) => ({
    id: `fc:fs:fs:emne:ntnu.no:${code}:1`,
    type: "fc:fs:emne",
    displayName: code,
    membership: { active: true },
});

const trondheimCourses = ["INGT1002", "IMAT1002", "IDATT1003"];

/** Outside every registration window, so an inactive flag may be acted on. */
const MID_TERM = new Date("2026-11-01T12:00:00Z");
/** Inside the autumn window, when "inactive" only means "not registered yet". */
const DURING_REGISTRATION = new Date("2026-08-19T12:00:00Z");

type FeideGroups = Parameters<typeof parseValidStudyPrograms>[0];

const seed = async (db: NodePgDatabase<DbSchema>) => {
    await db
        .insert(schema.group)
        .values([
            {
                slug: "digital-samhandling",
                name: "Digital transformasjon",
                type: "STUDY",
                finesInfo: "",
                finesActivated: false,
            },
            {
                slug: GROUP_SLUG,
                name: "Digital Transformasjon",
                type: "PRIVATE",
                finesInfo: "",
                finesActivated: true,
            },
        ])
        .onConflictDoNothing();

    const [programme] = await db
        .insert(schema.studyProgram)
        .values({
            slug: "digital-samhandling",
            feideCode: "ITMAIKTSA",
            displayName: "Digital Samhandling",
            type: "master",
        })
        .onConflictDoNothing()
        .returning({ id: schema.studyProgram.id });

    await db
        .update(schema.group)
        .set({ studyProgramId: programme?.id as number })
        .where(eq(schema.group.slug, GROUP_SLUG));

    await db
        .insert(schema.role)
        .values([{ name: "member" }, { name: "alumni" }])
        .onConflictDoNothing();

    return { programmeId: programme?.id as number };
};

const signIn = async (
    db: NodePgDatabase<DbSchema>,
    userId: string,
    groups: FeideGroups,
    now: Date,
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

const membershipOf = async (db: NodePgDatabase<DbSchema>, userId: string) => {
    const [row] = await db
        .select({ role: schema.groupMembership.role })
        .from(schema.groupMembership)
        .where(
            and(
                eq(schema.groupMembership.userId, userId),
                eq(schema.groupMembership.groupSlug, GROUP_SLUG),
            ),
        )
        .limit(1);
    return row ?? null;
};

const finesAdminOf = async (db: NodePgDatabase<DbSchema>) => {
    const [row] = await db
        .select({ finesAdminId: schema.group.finesAdminId })
        .from(schema.group)
        .where(eq(schema.group.slug, GROUP_SLUG))
        .limit(1);
    return row?.finesAdminId ?? null;
};

describe("a study programme's private group", () => {
    integrationTest(
        "enrols an active student whatever their cohort",
        async ({ ctx }) => {
            await seed(ctx.db);
            const fresh = await ctx.utils.createTestUser();
            const older = await ctx.utils.createTestUser();

            await signIn(
                ctx.db,
                fresh.id,
                [
                    prg("ITMAIKTSA"),
                    kull("ITMAIKTSA", "2026H"),
                    ...trondheimCourses.map(emne),
                ],
                MID_TERM,
            );
            await signIn(
                ctx.db,
                older.id,
                [
                    prg("ITMAIKTSA"),
                    kull("ITMAIKTSA", "2022H"),
                    ...trondheimCourses.map(emne),
                ],
                MID_TERM,
            );

            expect(await membershipOf(ctx.db, fresh.id)).toEqual({
                role: "member",
            });
            expect(await membershipOf(ctx.db, older.id)).toEqual({
                role: "member",
            });
        },
    );

    integrationTest(
        "keeps a student who is inactive but still inside the programme",
        async ({ ctx }) => {
            await seed(ctx.db);
            const user = await ctx.utils.createTestUser();

            await signIn(
                ctx.db,
                user.id,
                [
                    prg("ITMAIKTSA"),
                    kull("ITMAIKTSA", "2025H"),
                    ...trondheimCourses.map(emne),
                ],
                MID_TERM,
            );
            expect(await membershipOf(ctx.db, user.id)).not.toBeNull();

            /**
             * On exchange, on leave, or simply not registered: the flag is off,
             * but a 2025 master in 2026 is on their second year of a programme
             * that runs to five. They have not finished anything.
             */
            await signIn(
                ctx.db,
                user.id,
                [
                    prg("ITMAIKTSA", false),
                    kull("ITMAIKTSA", "2025H", false),
                    ...trondheimCourses.map(emne),
                ],
                MID_TERM,
            );

            expect(await membershipOf(ctx.db, user.id)).not.toBeNull();
        },
    );

    integrationTest(
        "keeps an inactive student inside the registration window",
        async ({ ctx }) => {
            await seed(ctx.db);
            const user = await ctx.utils.createTestUser();

            await signIn(
                ctx.db,
                user.id,
                [
                    prg("ITMAIKTSA"),
                    kull("ITMAIKTSA", "2019H"),
                    ...trondheimCourses.map(emne),
                ],
                MID_TERM,
            );
            expect(await membershipOf(ctx.db, user.id)).not.toBeNull();

            /**
             * Long past the programme's length, so outside August this would
             * be a removal. In the middle of the registration window it is not:
             * that is when "inactive" means "has not registered yet", and 4 of
             * the inactive rows in production are current students caught by
             * exactly this.
             */
            await signIn(
                ctx.db,
                user.id,
                [
                    prg("ITMAIKTSA", false),
                    kull("ITMAIKTSA", "2019H", false),
                    ...trondheimCourses.map(emne),
                ],
                DURING_REGISTRATION,
            );

            expect(await membershipOf(ctx.db, user.id)).not.toBeNull();
        },
    );

    integrationTest("removes a member who has finished", async ({ ctx }) => {
        await seed(ctx.db);
        const user = await ctx.utils.createTestUser();

        await signIn(
            ctx.db,
            user.id,
            [
                prg("ITMAIKTSA"),
                kull("ITMAIKTSA", "2019H"),
                ...trondheimCourses.map(emne),
            ],
            MID_TERM,
        );
        expect(await membershipOf(ctx.db, user.id)).not.toBeNull();

        await signIn(
            ctx.db,
            user.id,
            [
                prg("ITMAIKTSA", false),
                kull("ITMAIKTSA", "2019H", false),
                ...trondheimCourses.map(emne),
            ],
            MID_TERM,
        );

        expect(await membershipOf(ctx.db, user.id)).toBeNull();
    });

    integrationTest(
        "hands the leadership to the most senior active student, and the botsjef role with it",
        async ({ ctx }) => {
            await seed(ctx.db);

            const leader = await ctx.utils.createTestUser();
            const senior = await ctx.utils.createTestUser();
            const junior = await ctx.utils.createTestUser();

            // Two students who stay, on different intakes.
            await signIn(
                ctx.db,
                senior.id,
                [
                    prg("ITMAIKTSA"),
                    kull("ITMAIKTSA", "2025H"),
                    ...trondheimCourses.map(emne),
                ],
                MID_TERM,
            );
            await signIn(
                ctx.db,
                junior.id,
                [
                    prg("ITMAIKTSA"),
                    kull("ITMAIKTSA", "2026H"),
                    ...trondheimCourses.map(emne),
                ],
                MID_TERM,
            );

            // The leader, who is also botsjef, and who has finished.
            await signIn(
                ctx.db,
                leader.id,
                [
                    prg("ITMAIKTSA"),
                    kull("ITMAIKTSA", "2019H"),
                    ...trondheimCourses.map(emne),
                ],
                MID_TERM,
            );
            await ctx.db
                .update(schema.groupMembership)
                .set({ role: "leader" })
                .where(
                    and(
                        eq(schema.groupMembership.userId, leader.id),
                        eq(schema.groupMembership.groupSlug, GROUP_SLUG),
                    ),
                );
            await ctx.db
                .update(schema.group)
                .set({ finesAdminId: leader.id })
                .where(eq(schema.group.slug, GROUP_SLUG));

            await signIn(
                ctx.db,
                leader.id,
                [
                    prg("ITMAIKTSA", false),
                    kull("ITMAIKTSA", "2019H", false),
                    ...trondheimCourses.map(emne),
                ],
                MID_TERM,
            );

            expect(await membershipOf(ctx.db, leader.id)).toBeNull();

            // The earlier intake is the higher class level, so it inherits.
            expect(await membershipOf(ctx.db, senior.id)).toEqual({
                role: "leader",
            });
            expect(await membershipOf(ctx.db, junior.id)).toEqual({
                role: "member",
            });
            expect(await finesAdminOf(ctx.db)).toBe(senior.id);
        },
    );

    integrationTest(
        "leaves the leadership alone when no active student remains",
        async ({ ctx }) => {
            await seed(ctx.db);
            const leader = await ctx.utils.createTestUser();

            await signIn(
                ctx.db,
                leader.id,
                [
                    prg("ITMAIKTSA"),
                    kull("ITMAIKTSA", "2019H"),
                    ...trondheimCourses.map(emne),
                ],
                MID_TERM,
            );
            await ctx.db
                .update(schema.groupMembership)
                .set({ role: "leader" })
                .where(
                    and(
                        eq(schema.groupMembership.userId, leader.id),
                        eq(schema.groupMembership.groupSlug, GROUP_SLUG),
                    ),
                );
            await ctx.db
                .update(schema.group)
                .set({ finesAdminId: leader.id })
                .where(eq(schema.group.slug, GROUP_SLUG));

            await signIn(
                ctx.db,
                leader.id,
                [
                    prg("ITMAIKTSA", false),
                    kull("ITMAIKTSA", "2019H", false),
                    ...trondheimCourses.map(emne),
                ],
                MID_TERM,
            );

            /**
             * They are out of the roster, but still botsjef. Clearing it would
             * leave the group's fines with nobody to run them, and a stale
             * botsjef is something a human can fix — an absent one is not.
             */
            expect(await membershipOf(ctx.db, leader.id)).toBeNull();
            expect(await finesAdminOf(ctx.db)).toBe(leader.id);
        },
    );
});
