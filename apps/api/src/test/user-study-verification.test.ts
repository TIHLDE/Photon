import {
    FEIDE_CHECK_MAX_AGE_DAYS,
    isFeideCheckCurrent,
} from "@photon/auth/feide";
import { describe, expect, it } from "vitest";
import { deriveStudyFromGroups } from "~/lib/user/study";

/** Pinned so the tests do not change meaning as the semesters roll past. */
const NOW = new Date("2026-09-03T12:00:00Z");

const daysBefore = (days: number) =>
    new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const study = (
    slug: string,
    over: {
        feideActive?: boolean | null;
        feideCheckedAt?: Date | null;
        startYear?: number | null;
    } = {},
) => ({
    slug,
    name: slug,
    type: "STUDY",
    isStudyProgramme: true,
    ...over,
});

describe("isFeideCheckCurrent", () => {
    it("holds for 120 days and no longer", () => {
        expect(
            isFeideCheckCurrent(daysBefore(FEIDE_CHECK_MAX_AGE_DAYS - 1), NOW),
        ).toBe(true);
        expect(
            isFeideCheckCurrent(daysBefore(FEIDE_CHECK_MAX_AGE_DAYS + 1), NOW),
        ).toBe(false);
    });

    it("treats a missing answer as not current", () => {
        // Not the same as an old one, but it needs the same nudge: the only
        // way to get an answer at all is a Feide login.
        expect(isFeideCheckCurrent(null, NOW)).toBe(false);
        expect(isFeideCheckCurrent(undefined, NOW)).toBe(false);
    });

    it("survives a semester without expiring", () => {
        // The whole point of 120 over 90: a check from the start of the autumn
        // term must still count in December, because nothing about enrolment
        // can have changed since.
        const startOfTerm = new Date("2026-09-01T10:00:00Z");
        const december = new Date("2026-12-20T10:00:00Z");
        expect(isFeideCheckCurrent(startOfTerm, december)).toBe(true);
    });
});

describe("deriveStudyFromGroups — verification", () => {
    it("calls a recently confirmed enrolment active", () => {
        expect(
            deriveStudyFromGroups(
                [
                    study("dataingenir", {
                        feideActive: true,
                        feideCheckedAt: daysBefore(3),
                        startYear: 2025,
                    }),
                ],
                NOW,
            ).verification,
        ).toBe("active");
    });

    it("calls an old answer stale", () => {
        expect(
            deriveStudyFromGroups(
                [
                    study("dataingenir", {
                        feideActive: true,
                        feideCheckedAt: daysBefore(200),
                        startYear: 2025,
                    }),
                ],
                NOW,
            ).verification,
        ).toBe("stale");
    });

    it("calls a study Feide never spoke for unverified", () => {
        // 1346 study-group memberships in production look exactly like this.
        expect(
            deriveStudyFromGroups([study("dataingenir")], NOW).verification,
        ).toBe("unverified");
        expect(deriveStudyFromGroups([], NOW).verification).toBe("unverified");
    });

    it("reads the verification off the programme it actually shows", () => {
        // The master wins the ranking, so its fresh answer is the one that
        // counts — not the stale one on the bachelor left behind.
        const result = deriveStudyFromGroups(
            [
                study("dataingenir", {
                    feideActive: false,
                    feideCheckedAt: daysBefore(300),
                    startYear: 2022,
                }),
                study("digital-samhandling", {
                    feideActive: true,
                    feideCheckedAt: daysBefore(2),
                    startYear: 2026,
                }),
            ],
            NOW,
        );

        expect(result.studyProgram).toBe("digital-samhandling");
        expect(result.verification).toBe("active");
    });

    it("has nothing to say about a member with no programme at all", () => {
        // Only a cohort group. The answer is vacuously "unverified" — there is
        // no programme to have a Feide answer about — so the participant list
        // must not put a warning next to a study it is not showing.
        const onlyCohort = deriveStudyFromGroups(
            [{ slug: "2025", name: "2025", type: "STUDYYEAR" }],
            NOW,
        );

        expect(onlyCohort.studyProgram).toBeNull();
        expect(onlyCohort.verification).toBe("unverified");
    });

    it("keeps a confirmed departure apart from a confirmed enrolment", () => {
        expect(
            deriveStudyFromGroups(
                [
                    study("dataingenir", {
                        feideActive: false,
                        feideCheckedAt: daysBefore(5),
                        startYear: 2022,
                    }),
                ],
                NOW,
            ).verification,
        ).toBe("inactive");
    });

    it("calls an old 'not enrolled' stale, not inactive", () => {
        expect(
            deriveStudyFromGroups(
                [
                    study("dataingenir", {
                        feideActive: false,
                        feideCheckedAt: daysBefore(200),
                        startYear: 2022,
                    }),
                ],
                NOW,
            ).verification,
        ).toBe("stale");
    });
});
