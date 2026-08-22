import { Skeleton } from "@tihlde/ui/ui/skeleton";

export type OwnSubmission = {
    id: string;
    submittedAt: string;
    answers: { fieldId: string | null; text: string }[];
};

type FormOwnAnswersProps = {
    /** Spørsmålene i skjemaets rekkefølge, så svarene står i samme orden. */
    questions: { id: string; title: string }[];
    submissions: OwnSubmission[];
    isLoading?: boolean;
};

/**
 * Svarene den innloggede allerede har sendt inn på dette skjemaet.
 *
 * Vises både når skjemaet er ferdig besvart og når det tar imot flere svar —
 * i det siste tilfellet fikk man før bare et blankt skjema, uten noe tegn til
 * at man hadde svart før (issue #672).
 */
export function FormOwnAnswers({
    questions,
    submissions,
    isLoading,
}: FormOwnAnswersProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-20 w-full" />
            </div>
        );
    }

    if (submissions.length === 0) return null;

    return (
        <div className="flex flex-col gap-5">
            {submissions.map((submission, index) => (
                <div key={submission.id} className="flex flex-col gap-3">
                    <p className="text-sm font-medium">
                        {submissions.length > 1
                            ? `Svar ${submissions.length - index} · sendt inn ${submission.submittedAt}`
                            : `Sendt inn ${submission.submittedAt}`}
                    </p>
                    <dl className="flex flex-col gap-3">
                        {questions.map((question) => {
                            const answer = submission.answers.find(
                                (a) => a.fieldId === question.id,
                            );
                            return (
                                <div
                                    key={question.id}
                                    className="flex flex-col gap-0.5"
                                >
                                    <dt className="text-sm text-muted-foreground">
                                        {question.title}
                                    </dt>
                                    <dd className="text-sm">
                                        {answer?.text ? (
                                            answer.text
                                        ) : (
                                            <span className="text-muted-foreground">
                                                Ikke besvart
                                            </span>
                                        )}
                                    </dd>
                                </div>
                            );
                        })}
                    </dl>
                </div>
            ))}
        </div>
    );
}
