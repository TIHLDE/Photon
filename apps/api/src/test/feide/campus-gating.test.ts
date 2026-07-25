import {
    campusOfCourseCode,
    needsCampusFollowUp,
    parseValidStudyPrograms,
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

/** The courses a first-semester Dataingeniør student has, per campus. */
const firstSemester = {
    trondheim: ["INGT1002", "IMAT1002", "IDATT1003", "IDATT1004"],
    gjovik: ["INGG1002", "IMAG1002", "IDATG1003", "IDATG1004"],
    alesund: ["INGA1002", "IMAA1002", "IDATA1003", "IDATA1004"],
};

describe("campus gating of multi-campus study programmes", () => {
    test("accepts a BIDATA student in Trondheim", () => {
        const programs = parseValidStudyPrograms([
            kull("BIDATA", "2025H"),
            ...firstSemester.trondheim.map(emne),
        ]);

        assert.equal(programs.length, 1);
        assert.equal(programs[0]?.code, "BIDATA");
    });

    test("rejects a BIDATA student in Gjøvik", () => {
        const programs = parseValidStudyPrograms([
            kull("BIDATA", "2025H"),
            ...firstSemester.gjovik.map(emne),
        ]);

        assert.deepEqual(programs, []);
    });

    test("rejects a BIDATA student in Ålesund", () => {
        const programs = parseValidStudyPrograms([
            kull("BIDATA", "2025H"),
            ...firstSemester.alesund.map(emne),
        ]);

        assert.deepEqual(programs, []);
    });

    test("rejects a BDIGSEC student in Gjøvik", () => {
        const programs = parseValidStudyPrograms([
            kull("BDIGSEC", "2025H"),
            emne("DCSG1001"),
            emne("IMAG1002"),
        ]);

        assert.deepEqual(programs, []);
    });

    test("accepts a BDIGSEC student in Trondheim", () => {
        const programs = parseValidStudyPrograms([
            kull("BDIGSEC", "2025H"),
            emne("DCST1001"),
            emne("IMAT1002"),
        ]);

        assert.equal(programs[0]?.code, "BDIGSEC");
    });

    test("a single course at another campus does not move the student", () => {
        const programs = parseValidStudyPrograms([
            kull("BIDATA", "2025H"),
            ...firstSemester.trondheim.map(emne),
            emne("IDATG2001"),
        ]);

        assert.equal(programs[0]?.code, "BIDATA");
    });

    test("allows a student with no campus-marked courses yet", () => {
        // A brand new student whose FS course registrations have not landed.
        const programs = parseValidStudyPrograms([
            kull("BIDATA", "2025H"),
            emne("EXPH0600"),
            emne("HMS0002"),
        ]);

        assert.equal(programs[0]?.code, "BIDATA");
    });

    test("leaves single-campus programmes ungated", () => {
        // ITBAITBEDR only exists in Trondheim, so stray course codes from
        // elsewhere must not be able to lock the student out.
        const programs = parseValidStudyPrograms([
            kull("ITBAITBEDR", "2025H"),
            emne("IDATG1003"),
        ]);

        assert.equal(programs[0]?.code, "ITBAITBEDR");
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
            needsCampusFollowUp([{ code: "BIDATA", startYear: 2025 }], null),
        );
    });

    test("does not flag a resolved campus", () => {
        assert.isFalse(
            needsCampusFollowUp(
                [{ code: "BIDATA", startYear: 2025 }],
                "trondheim",
            ),
        );
    });

    test("does not flag single-campus programmes", () => {
        assert.isFalse(
            needsCampusFollowUp([{ code: "ITBAINFO", startYear: 2025 }], null),
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
});
