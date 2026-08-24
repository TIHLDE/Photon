import type {
    FormDetail,
    FormStatistics,
    SubmissionList,
    UpdateForm,
} from "@tihlde/sdk";
import { formatInOslo } from "#/lib/date";

export type FormQuestionType =
    | "text_answer"
    | "single_select"
    | "multiple_select";

/** Ett spørsmål slik det redigeres i grensesnittet. */
export type FormQuestionValues = {
    /** Satt for spørsmål som allerede finnes; nye spørsmål har ingen id. */
    id?: string;
    title: string;
    type: FormQuestionType;
    required: boolean;
    options: { id?: string; title: string }[];
};

/** Spørsmålene i skjemaet, i lagret rekkefølge. */
export function mapFormQuestions(
    fields: FormDetail["fields"],
): FormQuestionValues[] {
    return fields.map((field) => ({
        id: field.id,
        title: field.title,
        type: field.type,
        required: field.required,
        options: field.options.map((option) => ({
            id: option.id,
            title: option.title,
        })),
    }));
}

/**
 * Spørsmålene som API-payload. `order` følger rekkefølgen i listen, og
 * fritekstspørsmål sendes uten alternativer — de ville blitt slettet uansett.
 */
export function toFormFieldsPayload(
    questions: FormQuestionValues[],
): NonNullable<UpdateForm["fields"]> {
    return questions.map((question, index) => ({
        ...(question.id ? { id: question.id } : {}),
        title: question.title.trim(),
        type: question.type,
        required: question.required,
        order: index,
        options:
            question.type === "text_answer"
                ? []
                : question.options.map((option, optionIndex) => ({
                      ...(option.id ? { id: option.id } : {}),
                      title: option.title.trim(),
                      order: optionIndex,
                  })),
    }));
}

/**
 * Tidspunktet et planlagt skjema åpner eller stenger, f.eks.
 * «tor. 30. apr. 2026 kl. 12:00».
 */
export function formatFormScheduleAt(iso: string): string {
    return formatInOslo(iso, "EEE d. MMM yyyy 'kl.' HH:mm");
}

// -- Svar --

/** Ett svar på ett spørsmål, klart til visning. */
export type FormAnswer = {
    fieldId: string | null;
    /** Fritekstsvaret, eller de valgte alternativene skilt med komma. */
    text: string;
};

export type FormSubmissionRow = {
    id: string;
    /** Hvem som svarte. Brukes til å telle personer i stedet for svar. */
    userId: string;
    userName: string;
    userEmail: string;
    /** Studieretningen personen går på nå, om vi kjenner den. */
    studyProgram: string | null;
    /** Kullet, altså året de startet. */
    studyStartYear: number | null;
    submittedAt: string;
    answers: FormAnswer[];
};

export function mapSubmission(
    submission: SubmissionList[number],
): FormSubmissionRow {
    return {
        id: submission.id,
        userId: submission.user.id,
        userName: submission.user.name,
        userEmail: submission.user.email,
        studyProgram: submission.user.study_program,
        studyStartYear: submission.user.study_start_year,
        submittedAt: formatInOslo(submission.created_at, "d. MMM yyyy"),
        answers: submission.answers.map((answer) => ({
            fieldId: answer.field_id,
            text:
                answer.selected_options.length > 0
                    ? answer.selected_options
                          .map((option) => option.title)
                          .join(", ")
                    : (answer.answer_text ?? ""),
        })),
    };
}

/** Ett spørsmål med fordelingen av svar. Bare valgspørsmål har statistikk. */
export type FormQuestionStatistics = {
    id: string;
    title: string;
    options: {
        id: string;
        title: string;
        count: number;
        percentage: number;
    }[];
};

export function mapFormStatistics(
    statistics: FormStatistics["statistics"],
): FormQuestionStatistics[] {
    return statistics.map((question) => ({
        id: question.id,
        title: question.title,
        options: question.options.map((option) => ({
            id: option.id,
            title: option.title,
            count: option.answer_amount,
            percentage: option.answer_percentage,
        })),
    }));
}

/**
 * «BIDATA · kull 2023» — studieretning og kull på én linje, slik det står i
 * den første kolonnen i svarlista (issue #681). Tom når vi ikke vet noe.
 */
export function formatSubmissionStudy(
    programme: string | null,
    startYear: number | null,
): string | null {
    const parts = [programme, startYear ? `kull ${startYear}` : null].filter(
        Boolean,
    );
    return parts.length > 0 ? parts.join(" · ") : null;
}

/** Én andel i et sirkeldiagram, f.eks. ett kull eller én studieretning. */
export type FormStudySlice = {
    /**
     * Nøkkelen diagrammet bruker. Syntetisk, ikke navnet på kullet eller
     * studiet: den ender som CSS-variabelnavn i `ChartStyle`, som skriver
     * `<style>` med `dangerouslySetInnerHTML`. Et gruppenavn har mellomrom og
     * er skrevet av et menneske, og hører ikke hjemme der.
     */
    key: string;
    label: string;
    count: number;
    /** Andel av alle svarene, avrundet til hele prosent. */
    percentage: number;
    /** Restposten for dem vi ikke kjenner kullet eller studiet til. */
    unknown: boolean;
};

export type FormStudyDistribution = {
    cohorts: FormStudySlice[];
    programs: FormStudySlice[];
    /** Hva andelene er regnet ut av — svar eller personer, alt etter modus. */
    total: number;
};

/**
 * Om hvert svar teller for seg, eller om flere svar fra samme person teller
 * som én. De skiller lag på skjemaer som tar imot mer enn ett svar per
 * person, der den ivrigste ellers drar sitt eget kull opp.
 */
export type FormStudyCountMode = "submissions" | "people";

/** Én kategori med antallet svar som faller i den. `value: null` er restposten. */
type StudyBucket = {
    value: string | null;
    label: string;
    count: number;
};

function toSlices(
    buckets: StudyBucket[],
    total: number,
    keyPrefix: string,
    compare: (a: StudyBucket, b: StudyBucket) => number,
): FormStudySlice[] {
    return (
        [...buckets]
            // Restposten sist uansett hvordan resten sorteres — den er ikke et
            // kull eller et studieprogram på linje med de andre.
            .sort((a, b) => {
                if (a.value === null) return 1;
                if (b.value === null) return -1;
                return compare(a, b);
            })
            .map((bucket, index) => ({
                key:
                    bucket.value === null
                        ? `${keyPrefix}-ukjent`
                        : `${keyPrefix}-${index}`,
                label: bucket.label,
                count: bucket.count,
                percentage:
                    total > 0 ? Math.round((bucket.count / total) * 100) : 0,
                unknown: bucket.value === null,
            }))
    );
}

/** Teller opp én kategori per svar, med `null` for dem vi ikke vet noe om. */
function countBy(
    submissions: FormSubmissionRow[],
    valueOf: (submission: FormSubmissionRow) => string | null,
    labelOf: (value: string | null) => string,
): StudyBucket[] {
    const counts = new Map<string | null, number>();

    for (const submission of submissions) {
        const value = valueOf(submission);
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    return [...counts.entries()].map(([value, count]) => ({
        value,
        label: labelOf(value),
        count,
    }));
}

/**
 * Fordelingen av kull og studieretning blant dem som har svart. Regnes ut av
 * svarlista, som allerede har med studiet til hver enkelt, slik at
 * statistikken alltid kan vises — også for skjemaer uten valgspørsmål.
 *
 * `mode` bestemmer hva én andel er: ett svar, slik at summen stemmer med
 * antallet svar i fanen ved siden av, eller én person.
 */
export function summarizeFormStudy(
    submissions: FormSubmissionRow[],
    mode: FormStudyCountMode = "submissions",
): FormStudyDistribution {
    // Nyeste svar først fra API-et, så det er det siste svaret fra hver person
    // som blir stående når vi teller personer.
    const rows = mode === "people" ? uniqueByUser(submissions) : submissions;
    const total = rows.length;

    const cohorts = countBy(
        rows,
        (submission) =>
            submission.studyStartYear === null
                ? null
                : String(submission.studyStartYear),
        (value) => (value === null ? "Ukjent kull" : `Kull ${value}`),
    );
    const programs = countBy(
        rows,
        (submission) => submission.studyProgram,
        (value) => value ?? "Ukjent studieretning",
    );

    return {
        total,
        // Nyeste kull først, mens studieretningene sorteres på størrelse.
        cohorts: toSlices(
            cohorts,
            total,
            "kull",
            (a, b) => Number(b.value) - Number(a.value),
        ),
        programs: toSlices(
            programs,
            total,
            "studie",
            (a, b) => b.count - a.count || a.label.localeCompare(b.label, "nb"),
        ),
    };
}

/** Ett svar per person, det første i lista. */
function uniqueByUser(submissions: FormSubmissionRow[]): FormSubmissionRow[] {
    const seen = new Set<string>();
    return submissions.filter((submission) => {
        if (seen.has(submission.userId)) return false;
        seen.add(submission.userId);
        return true;
    });
}
