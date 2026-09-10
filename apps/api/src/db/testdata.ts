/**
 * Testdata for å verifisere es-toolkit-omleggingen i nettleseren.
 *
 * Lager alt med gjenkjennelige navn ("Testdata …"), og sletter gamle
 * testdata-rader først, så scriptet kan kjøres om igjen så ofte du vil.
 * Alt annet i databasen røres ikke.
 *
 * Kjør fra apps/api:  bun src/db/testdata.ts
 */
import { createDb, DISABLED_TIMEOUTS, schema } from "@photon/db";
import { env } from "@photon/core/env";
import {
    currentAcademicYear,
    MASTER_CLASS_OFFSET,
    MASTER_STUDY_SLUGS,
} from "@photon/auth/academic-year";
import { eq, inArray, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { uniq } from "es-toolkit";

const db = createDb({
    connectionString: env.DATABASE_URL,
    timeouts: DISABLED_TIMEOUTS,
});

const academicYear = currentAcademicYear();
const startYearFor = (classYear: number) => academicYear - classYear + 1;
const futureDate = (months: number) => {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date;
};

// ----- Users (6 members with class standings + roles for the breakdowns) -----

const STUDY_USERS = [
    // Tre førsteklassinger på Dataingeniør.
    { username: "testdata-1", classYear: 1, study: "dataingenir" },
    { username: "testdata-2", classYear: 1, study: "dataingenir" },
    { username: "testdata-3", classYear: 1, study: "dataingenir" },
    // To andreklassinger, også Dataingeniør.
    { username: "testdata-4", classYear: 2, study: "dataingenir" },
    { username: "testdata-5", classYear: 2, study: "dataingenir" },
    // En femteklassing på masteren (5-årig, egen intake).
    {
        username: "testdata-6",
        classYear: 5,
        study: MASTER_STUDY_SLUGS[0],
    },
] as const;

async function main() {
    const brotherman = await db.query.user.findFirst({
        where: eq(schema.user.username, "brotherman"),
    });
    if (!brotherman)
        throw new Error("brotherman finnes ikke — kjør seed først");

    // ----- Cleanup: fjern gamle testdata (FK-er kaskaderer resten) -----
    await db.delete(schema.event).where(like(schema.event.slug, "testdata-%"));
    await db
        .delete(schema.toddel)
        .where(inArray(schema.toddel.edition, [30, 31, 34]));
    await db.delete(schema.form).where(like(schema.form.title, "Testdata %"));
    await db
        .delete(schema.group)
        .where(
            inArray(schema.group.slug, uniq(STUDY_USERS.map((u) => u.study))),
        );
    await db.delete(schema.group).where(like(schema.group.slug, "testdata-%"));
    await db
        .delete(schema.user)
        .where(like(schema.user.email, "testdata-%@tihlde.org"));

    // ----- Study groups: én "study"-gruppe per studieprogram -----
    for (const study of uniq(STUDY_USERS.map((u) => u.study))) {
        await db.insert(schema.group).values({
            slug: study,
            name: `Testdata ${study}`,
            type: "study",
            description: "Testdatagruppe for studiestanding",
            finesInfo: "",
            finesActivated: false,
        });
    }

    // ----- Cohort groups ("studyyear"), kull etter startår -----
    const cohorts = new Set(STUDY_USERS.map((u) => startYearFor(u.classYear)));
    for (const year of cohorts) {
        await db.insert(schema.group).values({
            slug: `testdata-${year}`,
            name: String(year),
            type: "studyyear",
            description: "Testdatagruppe for kull",
            finesInfo: "",
            finesActivated: false,
        });
    }

    // ----- Users with standings -----
    const users: Record<string, string> = { brotherman: brotherman.id };
    for (const spec of STUDY_USERS) {
        const id = `testdata-${randomUUID()}`;
        await db.insert(schema.user).values({
            id,
            name: `Testdata ${spec.username}`,
            email: `${spec.username}@tihlde.org`,
            username: spec.username,
            displayUsername: spec.username,
            emailVerified: true,
            approvalStatus: "approved",
            approvedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Masteren teller 3 klassetrinn høyere enn sitt eget kull: 5.
        // klasse er kull to år tilbake (base 2 + offset 3).
        const startYear =
            spec.study === MASTER_STUDY_SLUGS[0]
                ? startYearFor(spec.classYear - MASTER_CLASS_OFFSET)
                : startYearFor(spec.classYear);
        await db.insert(schema.groupMembership).values([
            {
                userId: id,
                groupSlug: spec.study,
                role: "member",
            },
            {
                userId: id,
                groupSlug: `testdata-${startYear}`,
                role: "member",
            },
        ]);
        await db.insert(schema.studyProgramMembership).values({
            userId: id,
            studyProgramId: (await db.query.studyProgram.findFirst({
                where: eq(schema.studyProgram.slug, spec.study),
            }))!.id,
            startYear,
            startYearSource: "migrated",
        });
        users[spec.username] = id;
    }

    // ----- 1) sumBy: prikker på profilen (/profil/brotherman/prikker) -----
    const [strikeEvent] = await db
        .insert(schema.event)
        .values({
            title: "Testdata prikk-event",
            slug: "testdata-prikker",
            categorySlug: "annet",
            location: "R1",
            start: futureDate(1),
            end: futureDate(2),
            enforcesPreviousStrikes: false,
            createdByUserId: brotherman.id,
        })
        .returning();

    // Brotherman: 1 + 2 + 3 = 6 prikker totalt på profilen.
    await db.insert(schema.eventStrike).values([
        {
            eventId: strikeEvent!.id,
            userId: brotherman.id,
            count: 1,
            reason: "Testdata",
        },
        {
            eventId: strikeEvent!.id,
            userId: brotherman.id,
            count: 2,
            reason: "Testdata",
        },
        {
            eventId: strikeEvent!.id,
            userId: brotherman.id,
            count: 3,
            reason: "Testdata",
        },
        {
            eventId: strikeEvent!.id,
            userId: users["testdata-1"]!,
            count: 2,
            reason: "Testdata",
        },
        {
            eventId: strikeEvent!.id,
            userId: users["testdata-4"]!,
            count: 1,
            reason: "Testdata",
        },
    ]);

    // ----- 2) sumBy: betalinger på admin-arrangementssiden -----
    const [paidEvent] = await db
        .insert(schema.event)
        .values({
            title: "Testdata betalingsevent",
            slug: "testdata-betaling",
            categorySlug: "bedpres",
            location: "Scandic Lerkendal",
            capacity: 10,
            isPaidEvent: true,
            priceMinor: 25_000, // 250 kr
            start: futureDate(1),
            end: futureDate(2),
            enforcesPreviousStrikes: false,
            createdByUserId: brotherman.id,
        })
        .returning();
    await db.insert(schema.eventRegistration).values([
        { eventId: paidEvent!.id, userId: brotherman.id },
        { eventId: paidEvent!.id, userId: users["testdata-1"]! },
        { eventId: paidEvent!.id, userId: users["testdata-2"]! },
    ]);
    // Brotherman har to betalte rader: 250 + 150 = 400 kr (sumBy). Én
    // venter, én feilet — kortet skal vise 400 kr, ikke 550.
    await db.insert(schema.eventPayment).values([
        {
            eventId: paidEvent!.id,
            userId: brotherman.id,
            amountMinor: 25_000,
            status: "paid",
            receivedPaymentAt: new Date(),
        },
        {
            eventId: paidEvent!.id,
            userId: brotherman.id,
            amountMinor: 15_000,
            status: "paid",
            receivedPaymentAt: new Date(),
        },
        {
            eventId: paidEvent!.id,
            userId: users["testdata-1"]!,
            amountMinor: 25_000,
            status: "pending",
        },
        {
            eventId: paidEvent!.id,
            userId: users["testdata-2"]!,
            amountMinor: 25_000,
            status: "failed",
        },
    ]);

    // ----- 3) countBy: fordeling på admin-arrangementssiden -----
    const [distributionEvent] = await db
        .insert(schema.event)
        .values({
            title: "Testdata fordelingsevent",
            slug: "testdata-fordeling",
            categorySlug: "sosialt",
            location: "R1",
            capacity: 20,
            start: futureDate(1),
            end: futureDate(2),
            enforcesPreviousStrikes: false,
            createdByUserId: brotherman.id,
        })
        .returning();
    await db.insert(schema.eventRegistration).values(
        STUDY_USERS.map((spec) => ({
            eventId: distributionEvent!.id,
            userId: users[spec.username]!,
        })),
    );
    // Forventet: 3 × «1. klasse», 2 × «2. klasse», 1 × «5. klasse».

    // ----- 4) uniqBy: spørreundersøkelse med gjengiver -----
    const [form] = await db
        .insert(schema.form)
        .values({ title: "Testdata spørreundersøkelse" })
        .returning();
    const [textField] = await db
        .insert(schema.formField)
        .values({
            formId: form!.id,
            title: "Hva ønsker du å se mer av?",
            type: "text_answer",
            order: 0,
        })
        .returning();
    const [selectField] = await db
        .insert(schema.formField)
        .values({
            formId: form!.id,
            title: "Hvilken linje går du?",
            type: "single_select",
            order: 1,
        })
        .returning();
    const [optionData] = await db
        .insert(schema.formOption)
        .values({ fieldId: selectField!.id, title: "Dataingeniør", order: 0 })
        .returning();

    // Brotherman svarte to ganger (gjengivelse) — uniqBy skal telle ham én
    // gang, så «antall personer» (7) < «antall svar» (8).
    for (const username of [
        "brotherman",
        "brotherman",
        ...STUDY_USERS.map((u) => u.username),
    ]) {
        const [submission] = await db
            .insert(schema.formSubmission)
            .values({ formId: form!.id, userId: users[username]! })
            .returning();
        await db.insert(schema.formAnswer).values({
            submissionId: submission!.id,
            fieldId: textField!.id,
            answerText: "Testdata svar",
        });
        await db.insert(schema.formAnswer).values({
            submissionId: submission!.id,
            fieldId: selectField!.id,
        });
        const answer = await db.query.formAnswer.findFirst({
            where: eq(schema.formAnswer.submissionId, submission!.id),
            orderBy: (a, { desc }) => [desc(a.createdAt)],
        });
        if (answer) {
            await db
                .insert(schema.formAnswerOption)
                .values({ answerId: answer.id, optionId: optionData!.id });
        }
    }

    // ----- 5) maxBy: Toddel-utgaver (/admin/toddel) -----
    await db.insert(schema.toddel).values([
        {
            edition: 30,
            title: "Testdata TÖDDEL #30",
            pdfUrl: "https://example.com/toddel-30.pdf",
            publishedAt: "2024-01-01",
        },
        {
            edition: 31,
            title: "Testdata TÖDDEL #31",
            pdfUrl: "https://example.com/toddel-31.pdf",
            publishedAt: "2024-03-01",
        },
        {
            edition: 34,
            title: "Testdata TÖDDEL #34",
            pdfUrl: "https://example.com/toddel-34.pdf",
            publishedAt: "2024-09-01",
        },
    ]);

    console.log("✅ Testdata lagt inn. Forventede verdier å verifisere:");
    console.log("   1. sumBy — /profil/brotherman/prikker: totalt 6 prikker");
    console.log(
        "   2. sumBy — /admin/arrangementer/testdata-betaling: brotherman 400 kr (2 betalte rader)",
    );
    console.log(
        `   3. countBy — /admin/arrangementer/testdata-fordeling: 3 × 1. klasse, 2 × 2. klasse, 1 × 5. klasse (startår = kull ${[...cohorts].join(", ")})`,
    );
    console.log(
        "   4. uniqBy — /sporreskjema/…/svar: 8 svar, 7 personer (brotherman svarte to ganger)",
    );
    console.log(
        "   5. maxBy — /admin/toddel: neste utgave = 35 (høyeste arkiv = 34)",
    );
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
