import { format } from "date-fns";
import { nb } from "date-fns/locale";

import type {
    FormDetail,
    FormStatistics,
    SubmissionList,
    UpdateForm,
} from "@tihlde/sdk";

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
    return format(new Date(iso), "EEE d. MMM yyyy 'kl.' HH:mm", { locale: nb });
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
        submittedAt: format(new Date(submission.created_at), "d. MMM yyyy", {
            locale: nb,
        }),
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
