import {
    campusOfCourseCode,
    needsCampusFollowUp,
    parseValidStudyPrograms,
    partitionByCampus,
    resolveCampus,
} from "@photon/auth/feide";
import { assert, describe, test } from "vitest";

/**
 * NTNU runs BIDATA in Trondheim, Gjøvik and Ålesund under one programme code,
 * and the Feide `kull` group is identical across them. TIHLDE only covers
 * Trondheim, so the campus has to come from the course groups, where NTNU does
 * separate the campuses: IDATT/IDATG/IDATA, INGT/INGG/INGA, and so on.
 */

const kull = (code: string, year: string) => ({
    id: `fc:fs:fs:kull:ntnu.no:${code}:${year}`,
    type: "fc:fs:kull",
    displayName: `Kull for Høst ${year.slice(0, 4)} ${code}`,
});

const emne = (code: string) => ({
    id: `fc:fs:fs:emne:ntnu.no:${code}:1`,
    type: "fc:fs:emne",
    displayName: code,
});

/**
 * A course group as Feide actually sends it under `showAll=true`: with a
 * `membership.active` that says whether the member is still enrolled in it.
 * `emne` above deliberately omits the field, which is the other case the
 * campus reading has to survive.
 */
const emneActive = (code: string, active: boolean) => ({
    ...emne(code),
    membership: { active },
});

/**
 * The gate as the login hook composes it: parse the programmes, read the
 * campus off the courses, then split on campus.
 */
const gate = (groups: { id: string; type: string; displayName: string }[]) =>
    partitionByCampus(parseValidStudyPrograms(groups), resolveCampus(groups));

/** The courses a first-semester Dataingeniør student has, per campus. */
const firstSemester = {
    trondheim: ["INGT1002", "IMAT1002", "IDATT1003", "IDATT1004"],
    gjovik: ["INGG1002", "IMAG1002", "IDATG1003", "IDATG1004"],
    alesund: ["INGA1002", "IMAA1002", "IDATA1003", "IDATA1004"],
};

describe("campus gating of multi-campus study programmes", () => {
    test("accepts a BIDATA student in Trondheim", () => {
        const { allowed } = gate([
            kull("BIDATA", "2025H"),
            ...firstSemester.trondheim.map(emne),
        ]);

        assert.equal(allowed.length, 1);
        assert.equal(allowed[0]?.code, "BIDATA");
    });

    test("rejects a BIDATA student in Gjøvik", () => {
        const { allowed, campusRejected } = gate([
            kull("BIDATA", "2025H"),
            ...firstSemester.gjovik.map(emne),
        ]);

        assert.deepEqual(allowed, []);
        assert.equal(campusRejected[0]?.code, "BIDATA");
    });

    test("rejects a BIDATA student in Ålesund", () => {
        const { allowed, campusRejected } = gate([
            kull("BIDATA", "2025H"),
            ...firstSemester.alesund.map(emne),
        ]);

        assert.deepEqual(allowed, []);
        assert.equal(campusRejected[0]?.code, "BIDATA");
    });

    test("rejects a BDIGSEC student in Gjøvik", () => {
        const { allowed, campusRejected } = gate([
            kull("BDIGSEC", "2025H"),
            emne("DCSG1001"),
            emne("IMAG1002"),
        ]);

        assert.deepEqual(allowed, []);
        assert.equal(campusRejected[0]?.code, "BDIGSEC");
    });

    test("accepts a BDIGSEC student in Trondheim", () => {
        const { allowed } = gate([
            kull("BDIGSEC", "2025H"),
            emne("DCST1001"),
            emne("IMAT1002"),
        ]);

        assert.equal(allowed[0]?.code, "BDIGSEC");
    });

    test("a single course at another campus does not move the student", () => {
        const { allowed } = gate([
            kull("BIDATA", "2025H"),
            ...firstSemester.trondheim.map(emne),
            emne("IDATG2001"),
        ]);

        assert.equal(allowed[0]?.code, "BIDATA");
    });

    test("allows a student with no campus-marked courses yet", () => {
        // A brand new student whose FS course registrations have not landed.
        const { allowed } = gate([
            kull("BIDATA", "2025H"),
            emne("EXPH0600"),
            emne("HMS0002"),
        ]);

        assert.equal(allowed[0]?.code, "BIDATA");
    });

    test("leaves single-campus programmes ungated", () => {
        // ITBAITBEDR only exists in Trondheim, so stray course codes from
        // elsewhere must not be able to lock the student out.
        const { allowed } = gate([
            kull("ITBAITBEDR", "2025H"),
            emne("IDATG1003"),
        ]);

        assert.equal(allowed[0]?.code, "ITBAITBEDR");
    });
});

/**
 * `showAll=true` brings back every course the member has ever been enrolled
 * in, so a semester finished at another campus is in the same response as the
 * one they are in now. Counting both is what stranded a first-year BDIGSEC
 * student in Trondheim on 2026-08-17: his lapsed courses outvoted the courses
 * he had yet to be registered for, the gate held BDIGSEC back, and he lost his
 * study programme, his cohort and every group on the account.
 */
describe("lapsed course memberships", () => {
    test("does not reject a student whose only other-campus courses have lapsed", () => {
        const { allowed, campusRejected } = gate([
            kull("BDIGSEC", "2026H"),
            emneActive("DCSG1001", false),
            emneActive("IMAG1002", false),
        ]);

        assert.equal(allowed[0]?.code, "BDIGSEC");
        assert.deepEqual(campusRejected, []);
    });

    test("still rejects a student whose other-campus courses are active", () => {
        const { allowed, campusRejected } = gate([
            kull("BDIGSEC", "2026H"),
            emneActive("DCSG1001", true),
            emneActive("IMAG1002", true),
        ]);

        assert.deepEqual(allowed, []);
        assert.equal(campusRejected[0]?.code, "BDIGSEC");
    });

    test("a lapsed semester elsewhere does not outvote the current one", () => {
        const { allowed } = gate([
            kull("BIDATA", "2026H"),
            ...firstSemester.gjovik.map((c) => emneActive(c, false)),
            emneActive("IDATT1003", true),
        ]);

        assert.equal(allowed[0]?.code, "BIDATA");
    });

    test("keeps counting every course when Feide sends no activity at all", () => {
        // The gate must not fall open on a response that omits the field:
        // an empty ballot means campus null, and campus null lets everyone in.
        const { allowed, campusRejected } = gate([
            kull("BIDATA", "2026H"),
            ...firstSemester.gjovik.map(emne),
        ]);

        assert.deepEqual(allowed, []);
        assert.equal(campusRejected[0]?.code, "BIDATA");
    });
});

describe("campusOfCourseCode", () => {
    test("reads the campus letter of known course families", () => {
        assert.equal(campusOfCourseCode("IDATT2003"), "trondheim");
        assert.equal(campusOfCourseCode("IDATG2003"), "gjovik");
        assert.equal(campusOfCourseCode("IDATA2003"), "alesund");
        assert.equal(campusOfCourseCode("INGT1002"), "trondheim");
        assert.equal(campusOfCourseCode("ISTG1001"), "gjovik");
        assert.equal(campusOfCourseCode("IFYA1002"), "alesund");
        assert.equal(campusOfCourseCode("DCST1001"), "trondheim");
    });

    test("ignores codes with no campus marker", () => {
        // The trailing letters here are part of the subject, not a campus.
        assert.equal(campusOfCourseCode("TDT4127"), null);
        assert.equal(campusOfCourseCode("EXPH0600"), null);
        assert.equal(campusOfCourseCode("HMS0002"), null);
        assert.equal(campusOfCourseCode("PROG1001"), null);
        assert.equal(campusOfCourseCode(""), null);
    });
});

describe("needsCampusFollowUp", () => {
    test("flags a multi-campus programme with unresolved campus", () => {
        assert.isTrue(
            needsCampusFollowUp(
                [{ code: "BIDATA", startYear: 2025, active: true }],
                null,
            ),
        );
    });

    test("does not flag a resolved campus", () => {
        assert.isFalse(
            needsCampusFollowUp(
                [{ code: "BIDATA", startYear: 2025, active: true }],
                "trondheim",
            ),
        );
    });

    test("does not flag single-campus programmes", () => {
        assert.isFalse(
            needsCampusFollowUp(
                [{ code: "ITBAINFO", startYear: 2025, active: true }],
                null,
            ),
        );
    });

    test("does not flag a login with no TIHLDE programmes at all", () => {
        assert.isFalse(needsCampusFollowUp([], null));
    });
});

describe("resolveCampus", () => {
    test("ignores non-course groups", () => {
        assert.equal(
            resolveCampus([
                kull("BIDATA", "2025H"),
                {
                    id: "fc:fs:fs:klasse:ntnu.no:BIDATA:2025H:OT",
                    type: "fc:fs:klasse",
                    displayName: "Klasse",
                },
            ]),
            null,
        );
    });

    test("returns null on a tie", () => {
        assert.equal(
            resolveCampus([emne("IDATT1003"), emne("IDATG1003")]),
            null,
        );
    });

    test("returns null when every campus-marked course has lapsed", () => {
        assert.equal(
            resolveCampus([
                emneActive("IDATG1003", false),
                emneActive("IDATG1004", false),
            ]),
            null,
        );
    });

    test("an active course outvotes any number of lapsed ones", () => {
        assert.equal(
            resolveCampus([
                emneActive("IDATG1003", false),
                emneActive("IDATG1004", false),
                emneActive("INGG1002", false),
                emneActive("IDATT1003", true),
            ]),
            "trondheim",
        );
    });

    test("ignores activity on non-course groups when deciding to filter", () => {
        // The cohort carries `membership.active` too. If its presence were
        // what switched the filter on, a member with an active cohort and
        // course groups that omit the field would vote with nothing at all.
        assert.equal(
            resolveCampus([
                { ...kull("BIDATA", "2026H"), membership: { active: true } },
                emne("IDATG1003"),
                emne("IDATG1004"),
            ]),
            "gjovik",
        );
    });
});
