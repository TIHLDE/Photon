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
 * Tidspunktet et planlagt skjema åpner, f.eks. «tor. 30. apr. 2026 kl. 12:00».
 */
export function formatFormOpensAt(iso: string): string {
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
    /** Nøkkelen diagrammet bruker, unik innenfor sitt diagram. */
    key: string;
    label: string;
    count: number;
    /** Andel av alle svarene, avrundet til hele prosent. */
    percentage: number;
};

export type FormStudyDistribution = {
    cohorts: FormStudySlice[];
    programs: FormStudySlice[];
};

const UNKNOWN_KEY = "ukjent";

function toSlices(
    counts: Map<string, { label: string; count: number }>,
    total: number,
    compare: (a: FormStudySlice, b: FormStudySlice) => number,
): FormStudySlice[] {
    const slices = [...counts.entries()].map(([key, { label, count }]) => ({
        key,
        label,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

    // «Ukjent» sist uansett hvordan resten sorteres — den er en restpost, ikke
    // et kull eller et studieprogram på linje med de andre.
    return slices.sort((a, b) => {
        if (a.key === UNKNOWN_KEY) return 1;
        if (b.key === UNKNOWN_KEY) return -1;
        return compare(a, b);
    });
}

/**
 * Fordelingen av kull og studieretning blant dem som har svart. Regnes ut av
 * svarlista, som allerede har med studiet til hver enkelt, slik at
 * statistikken alltid kan vises — også for skjemaer uten valgspørsmål.
 */
export function summarizeFormStudy(
    submissions: FormSubmissionRow[],
): FormStudyDistribution {
    const cohorts = new Map<string, { label: string; count: number }>();
    const programs = new Map<string, { label: string; count: number }>();

    for (const submission of submissions) {
        const cohortKey = submission.studyStartYear
            ? String(submission.studyStartYear)
            : UNKNOWN_KEY;
        const cohortLabel = submission.studyStartYear
            ? `Kull ${submission.studyStartYear}`
            : "Ukjent kull";
        const programKey = submission.studyProgram ?? UNKNOWN_KEY;
        const programLabel = submission.studyProgram ?? "Ukjent studieretning";

        const cohort = cohorts.get(cohortKey);
        if (cohort) cohort.count += 1;
        else cohorts.set(cohortKey, { label: cohortLabel, count: 1 });

        const program = programs.get(programKey);
        if (program) program.count += 1;
        else programs.set(programKey, { label: programLabel, count: 1 });
    }

    const total = submissions.length;

    return {
        // Nyeste kull først, mens studieretningene sorteres på størrelse.
        cohorts: toSlices(cohorts, total, (a, b) => b.key.localeCompare(a.key)),
        programs: toSlices(
            programs,
            total,
            (a, b) => b.count - a.count || a.label.localeCompare(b.label, "nb"),
        ),
    };
}
