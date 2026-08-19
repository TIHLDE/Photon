import { describe, expect, it } from "vitest";
import { computeUserClassYear, isUserPrioritized } from "~/lib/event/priority";

/** Pinned so the tests do not change meaning every August. */
const AUTUMN_2026 = new Date("2026-10-01T12:00:00Z");
const SPRING_2026 = new Date("2026-03-01T12:00:00Z");

function cohort(year: number) {
    return { slug: String(year), name: String(year), type: "STUDYYEAR" };
}

const BACHELOR = { slug: "dataingenir", name: "Dataingeniør", type: "STUDY" };
const MASTER = {
    slug: "digital-samhandling",
    name: "Digital transformasjon",
    type: "STUDY",
};

describe("computeUserClassYear", () => {
    it("places a member on the class level their cohort implies", () => {
        expect(
            computeUserClassYear([BACHELOR, cohort(2026)], AUTUMN_2026),
        ).toBe(1);
        expect(
            computeUserClassYear([BACHELOR, cohort(2025)], AUTUMN_2026),
        ).toBe(2);
        expect(
            computeUserClassYear([BACHELOR, cohort(2024)], AUTUMN_2026),
        ).toBe(3);
    });

    it("rolls over in August, not in January", () => {
        // The 2025 intake is in its first year until the 2026 academic year
        // starts. Getting this wrong shifts every class-level pool by one for
        // eight months of the year.
        expect(
            computeUserClassYear([BACHELOR, cohort(2025)], SPRING_2026),
        ).toBe(1);
        expect(
            computeUserClassYear(
                [BACHELOR, cohort(2025)],
                new Date("2026-07-31T12:00:00Z"),
            ),
        ).toBe(1);
        expect(
            computeUserClassYear(
                [BACHELOR, cohort(2025)],
                new Date("2026-08-01T12:00:00Z"),
            ),
        ).toBe(2);
    });

    it("returns null for a member with no cohort at all", () => {
        expect(computeUserClassYear([BACHELOR], AUTUMN_2026)).toBeNull();
        expect(computeUserClassYear([], AUTUMN_2026)).toBeNull();
    });

    it("returns null for alumni, so they match no class-level pool", () => {
        expect(
            computeUserClassYear([BACHELOR, cohort(2019)], AUTUMN_2026),
        ).toBeNull();
    });

    it("stops counting a bachelor at three years, not five", () => {
        /**
         * The ceiling used to be a flat five for everyone, so a finished
         * three-year bachelor kept counting: the 2023 intake read as 4. klasse
         * and the 2022 intake as 5., and 398 members in production sat in that
         * state. Any pool asking for 4. or 5. klasse without naming a study
         * would have pulled them in ahead of the master students it was for.
         */
        expect(
            computeUserClassYear([BACHELOR, cohort(2023)], AUTUMN_2026),
        ).toBeNull();
        expect(
            computeUserClassYear([BACHELOR, cohort(2022)], AUTUMN_2026),
        ).toBeNull();

        // The last year that is still a real class level.
        expect(
            computeUserClassYear([BACHELOR, cohort(2024)], AUTUMN_2026),
        ).toBe(3);
    });

    it("uses the master's own intake when we have it", () => {
        /**
         * With the programme's own start year there is nothing to infer: year
         * one of a master is 4. klasse. The cohort group here says 2023, the
         * year their *bachelor* began — reading that instead is the confusion
         * the programme row exists to end.
         */
        const master = { ...MASTER, isMaster: true, startYear: 2026 };
        expect(computeUserClassYear([master, cohort(2023)], AUTUMN_2026)).toBe(
            4,
        );

        const secondYear = { ...MASTER, isMaster: true, startYear: 2025 };
        expect(
            computeUserClassYear([secondYear, cohort(2022)], AUTUMN_2026),
        ).toBe(5);
    });

    it("still reads the cohort group when the master has no year of its own", () => {
        // The 1423 members migrated from Lepton have groups and no programme
        // row, so this path has to keep working.
        expect(computeUserClassYear([MASTER, cohort(2023)], AUTUMN_2026)).toBe(
            4,
        );
    });

    it("puts a master's first year on 4. klasse, not 1.", () => {
        // Someone who came to the master from another school has only the
        // master's own intake year. Read naively that is "1. klasse", which
        // would both miss the digtrans pools and wrongly match first-years.
        expect(computeUserClassYear([MASTER, cohort(2026)], AUTUMN_2026)).toBe(
            4,
        );
        expect(computeUserClassYear([MASTER, cohort(2025)], AUTUMN_2026)).toBe(
            5,
        );
    });

    it("keeps a bachelor-then-master member on the master's class levels", () => {
        // Memberships are additive, so this member carries both cohorts. The
        // newest one wins, and the master offset applies to it.
        const groups = [BACHELOR, MASTER, cohort(2023), cohort(2026)];
        expect(computeUserClassYear(groups, AUTUMN_2026)).toBe(4);
    });

    it("reads a master cohort that never got its own intake year", () => {
        // No `fc:fs:kull` for the master, so the newest cohort is still the
        // bachelor's. 2023 + 3 years of bachelor lands on 4. klasse already,
        // and adding the offset again would read as an alumnus.
        expect(computeUserClassYear([MASTER, cohort(2023)], AUTUMN_2026)).toBe(
            4,
        );
    });
});

describe("isUserPrioritized", () => {
    const base = {
        strikeCount: 0,
        enforcesPreviousStrikes: false,
        isNamedIndividually: false,
    };

    /** Innpakning: reglene er pooler pluss navngitte, og her testes poolene. */
    const withPools = (
        pools: Array<{ groupSlug: string | null; classYear: number | null }>,
    ) => ({ pools, priorityUsers: [] });

    it("matches a group-only pool on membership alone", () => {
        expect(
            isUserPrioritized({
                ...base,
                userGroupSlugs: new Set(["index"]),
                userClassYear: null,
                event: withPools([{ groupSlug: "index", classYear: null }]),
            }),
        ).toBe(true);
    });

    it("matches a class-only pool regardless of groups", () => {
        expect(
            isUserPrioritized({
                ...base,
                userGroupSlugs: new Set(),
                userClassYear: 2,
                event: withPools([{ groupSlug: null, classYear: 2 }]),
            }),
        ).toBe(true);
    });

    it("does not match a neighbouring class level", () => {
        for (const classYear of [1, 3]) {
            expect(
                isUserPrioritized({
                    ...base,
                    userGroupSlugs: new Set(),
                    userClassYear: 2,
                    event: withPools([{ groupSlug: null, classYear }]),
                }),
            ).toBe(false);
        }
    });

    it("requires both criteria when a pool sets both", () => {
        const pool = [{ groupSlug: "digital-samhandling", classYear: 4 }];

        expect(
            isUserPrioritized({
                ...base,
                userGroupSlugs: new Set(["digital-samhandling"]),
                userClassYear: 4,
                event: withPools(pool),
            }),
        ).toBe(true);

        // Right study, wrong year.
        expect(
            isUserPrioritized({
                ...base,
                userGroupSlugs: new Set(["digital-samhandling"]),
                userClassYear: 5,
                event: withPools(pool),
            }),
        ).toBe(false);

        // Right year, wrong study.
        expect(
            isUserPrioritized({
                ...base,
                userGroupSlugs: new Set(["dataingenir"]),
                userClassYear: 4,
                event: withPools(pool),
            }),
        ).toBe(false);
    });

    it("treats pools as alternatives", () => {
        expect(
            isUserPrioritized({
                ...base,
                userGroupSlugs: new Set(["index"]),
                userClassYear: null,
                event: withPools([
                    { groupSlug: null, classYear: 1 },
                    { groupSlug: "index", classYear: null },
                ]),
            }),
        ).toBe(true);
    });

    it("never matches an empty pool", () => {
        // Unreachable through the API and the CHECK constraint, but an empty
        // pool asks nothing — read literally it would prioritize everyone.
        expect(
            isUserPrioritized({
                ...base,
                userGroupSlugs: new Set(),
                userClassYear: null,
                event: withPools([{ groupSlug: null, classYear: null }]),
            }),
        ).toBe(false);
    });

    it("keeps striking out members with three or more strikes", () => {
        expect(
            isUserPrioritized({
                userGroupSlugs: new Set(["index"]),
                userClassYear: null,
                event: withPools([{ groupSlug: "index", classYear: null }]),
                strikeCount: 3,
                enforcesPreviousStrikes: true,
                isNamedIndividually: false,
            }),
        ).toBe(false);
    });
});
