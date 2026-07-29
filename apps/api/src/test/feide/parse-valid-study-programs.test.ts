import { parseValidStudyPrograms } from "@photon/auth/feide";
import { assert, describe, test } from "vitest";

describe("feide parse valid study programs", () => {
    test("parses valid study programs", () => {
        const groups = [
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT2501:1",
                type: "fc:fs:emne",
                displayName: "Fordypningsprosjekt",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:klasse:ntnu.no:BIDATA:2023H:OT",
                type: "fc:fs:klasse",
                displayName:
                    "Klasse Data - bachelor i ingeniørfag OT Høst 2023",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                },
                parent: "fc:fs:fs:kull:ntnu.no:BIDATA:2023H",
            },
            {
                id: "fc:fs:fs:prg:ntnu.no:BIDATA",
                type: "fc:fs:prg",
                displayName: "Data - bachelor i ingeniørfag",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                },
                parent: "fc:org:ntnu.no",
                url: "https://www.ntnu.no/studier/bidata",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT2003:1",
                type: "fc:fs:emne",
                displayName: "Programmering 2",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2024-08-14T22:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT2002:1",
                type: "fc:fs:emne",
                displayName: "Databaser",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2024-08-14T22:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:HMS0002:1",
                type: "fc:fs:emne",
                displayName: "HMS-kurs for 1. årsstudenter",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2023-12-14T23:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:EXPH0600:1",
                type: "fc:fs:emne",
                displayName: "Examen philosophicum for ingeniørfag ",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2024-12-14T23:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:INGT1002:1",
                type: "fc:fs:emne",
                displayName: "Programmering, numerikk og sikkerhet",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2023-12-14T23:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IMAT3011:1",
                type: "fc:fs:emne",
                displayName: "Matematikk for ingeniørfag 3 A",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT1005:1",
                type: "fc:fs:emne",
                displayName: "Systemutvikling",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2024-08-14T22:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT1003:1",
                type: "fc:fs:emne",
                displayName: "Programmering 1",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2023-12-14T23:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IMAT1002:1",
                type: "fc:fs:emne",
                displayName: "Matematikk for ingeniørfag 1",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2023-12-14T23:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT1004:1",
                type: "fc:fs:emne",
                displayName: "Teambasert samhandling",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2023-12-14T23:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:str:ntnu.no:BIDATA-SYSUTV",
                type: "fc:fs:str",
                displayName: "Systemutvikling",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT2202:1",
                type: "fc:fs:emne",
                displayName: "Operativsystemer",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2024-12-14T23:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IMAT2024:1",
                type: "fc:fs:emne",
                displayName: "Matematikk for ingeniørfag 2 D",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2024-08-14T22:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:kull:ntnu.no:BIDATA:2023H",
                type: "fc:fs:kull",
                displayName: "Kull for Høst 2023 Data - bachelor i ingeniørfag",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                },
                parent: "fc:fs:fs:prg:BIDATA",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT2901:1",
                type: "fc:fs:emne",
                displayName: "Bacheloroppgave",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2025-12-14T23:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:ISTT1003:1",
                type: "fc:fs:emne",
                displayName: "Statistikk",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2024-12-14T23:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT2104:1",
                type: "fc:fs:emne",
                displayName: "Nettverksprogrammering",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2025-08-14T22:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IFYT1002:1",
                type: "fc:fs:emne",
                displayName: "Fysikk",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2025-08-14T22:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT2106:1",
                type: "fc:fs:emne",
                displayName: "Systemutvikling 2 med smidig prosjekt",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2025-08-14T22:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT2105:1",
                type: "fc:fs:emne",
                displayName: "Full-stack applikasjonsutvikling",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2025-08-14T22:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT2503:1",
                type: "fc:fs:emne",
                displayName: "Sikkerhet i programvare og kryptografi",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT2506:1",
                type: "fc:fs:emne",
                displayName: "Applikasjonsutvikling for mobile enheter",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                },
                parent: "fc:org:ntnu.no",
            },
            {
                id: "fc:fs:fs:emne:ntnu.no:IDATT2101:1",
                type: "fc:fs:emne",
                displayName: "Algoritmer og datastrukturer",
                membership: {
                    basic: "member",
                    active: true,
                    displayName: "Student",
                    fsroles: ["STUDENT"],
                    notAfter: "2024-12-14T23:00:00Z",
                    subjectRelations: "undervisning",
                },
                parent: "fc:org:ntnu.no",
            },
        ];

        const validStudyPrograms = parseValidStudyPrograms(groups);
        assert.equal(validStudyPrograms.length, 1);
        assert.equal(validStudyPrograms[0]?.code, "BIDATA");
        assert.equal(validStudyPrograms[0]?.startYear, 2023);
    });
});

/**
 * A cohort membership is only valid for a bounded period, so an upper-year
 * student's `fc:fs:kull` group has lapsed and — before `showAll=true` — was not
 * returned at all. That is why no member in production ever got a study
 * programme: the parser only read cohorts. It now reads the programme group
 * too, and takes "currently enrolled" from `membership.active` rather than from
 * a group merely being present.
 */
describe("parseValidStudyPrograms — programme and cohort groups", () => {
    const member = (active: boolean) => ({
        basic: "member",
        active,
        displayName: "Student",
        fsroles: ["STUDENT"],
    });

    const prg = (code: string, active = true) => ({
        id: `fc:fs:fs:prg:ntnu.no:${code}`,
        type: "fc:fs:prg",
        displayName: `${code} - bachelor`,
        membership: member(active),
    });

    const kull = (code: string, term: string, active = true) => ({
        id: `fc:fs:fs:kull:ntnu.no:${code}:${term}`,
        type: "fc:fs:kull",
        displayName: `Kull ${term} ${code}`,
        membership: member(active),
    });

    test("accepts a programme group alone, with no start year", () => {
        const [program, ...rest] = parseValidStudyPrograms([prg("ITBAITBEDR")]);

        assert.lengthOf(rest, 0);
        assert.equal(program?.code, "ITBAITBEDR");
        assert.equal(program?.startYear, null);
        assert.isTrue(program?.active);
    });

    test("an active programme keeps the member active even when the cohort has lapsed", () => {
        const [program] = parseValidStudyPrograms([
            prg("ITBAITBEDR", true),
            kull("ITBAITBEDR", "2023H", false),
        ]);

        assert.equal(program?.startYear, 2023, "year comes from the cohort");
        assert.isTrue(program?.active, "programme still active");
    });

    test("reports inactive when every group has lapsed", () => {
        const [program] = parseValidStudyPrograms([
            prg("BIDATA", false),
            kull("BIDATA", "2019H", false),
        ]);

        assert.equal(program?.code, "BIDATA");
        assert.equal(program?.startYear, 2019);
        assert.isFalse(program?.active);
    });

    test("collapses a programme and its cohort into one entry", () => {
        const programs = parseValidStudyPrograms([
            prg("BIDATA"),
            kull("BIDATA", "2023H"),
        ]);

        assert.lengthOf(programs, 1);
        assert.equal(programs[0]?.startYear, 2023);
    });

    test("prefers a concrete year regardless of group order", () => {
        const withCohortLast = parseValidStudyPrograms([
            prg("BIDATA"),
            kull("BIDATA", "2022H"),
        ]);
        const withCohortFirst = parseValidStudyPrograms([
            kull("BIDATA", "2022H"),
            prg("BIDATA"),
        ]);

        assert.equal(withCohortLast[0]?.startYear, 2022);
        assert.equal(withCohortFirst[0]?.startYear, 2022);
    });

    test("keeps the programme when the cohort year is unparseable, without throwing", () => {
        const programs = parseValidStudyPrograms([
            prg("BIDATA"),
            kull("BIDATA", "haust"),
        ]);

        assert.lengthOf(programs, 1);
        assert.equal(programs[0]?.startYear, null);
    });

    test("rejects an implausible year rather than storing it", () => {
        const [program] = parseValidStudyPrograms([kull("BIDATA", "1899H")]);

        assert.equal(program?.code, "BIDATA");
        assert.equal(program?.startYear, null);
    });

    test("ignores programmes outside the allowlist", () => {
        assert.lengthOf(
            parseValidStudyPrograms([prg("MTBYGG"), kull("MTBYGG", "2023H")]),
            0,
        );
    });

    test("ignores study-right groups whose code carries a specialisation suffix", () => {
        assert.lengthOf(
            parseValidStudyPrograms([
                {
                    id: "fc:fs:fs:str:ntnu.no:BIDATA-SYSUTV",
                    type: "fc:fs:str",
                    displayName: "Systemutvikling",
                    membership: member(true),
                },
            ]),
            0,
        );
    });

    test("returns one entry per programme for a member on two", () => {
        const programs = parseValidStudyPrograms([
            prg("BIDATA"),
            kull("BIDATA", "2020H"),
            prg("ITMAIKTSA"),
            kull("ITMAIKTSA", "2023H"),
        ]);

        assert.lengthOf(programs, 2);
        assert.deepEqual(
            programs.map((p) => `${p.code}:${p.startYear}`).sort(),
            ["BIDATA:2020", "ITMAIKTSA:2023"],
        );
    });
});
