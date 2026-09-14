import { Link } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { HelpCircle } from "lucide-react";

export type PendingEvaluation = {
    formId: string;
    eventTitle: string;
};

/**
 * Vises i påmeldingskortet når medlemmet skylder svar på en evaluering.
 *
 * Sperren har alltid ligget i API-et, men ga bare en feilmelding i det man
 * trykket «Meld deg på» — uten lenke til skjemaet som løser den opp. Nå står
 * den framme, på samme måte som arrangementsreglene, med veien videre i seg.
 */
export function EventEvaluationNotice({
    evaluations,
}: {
    evaluations: PendingEvaluation[];
}) {
    if (evaluations.length === 0) return null;

    return (
        <Alert>
            <HelpCircle className="size-4" />
            <AlertTitle>
                {evaluations.length === 1
                    ? "Du mangler svar på en evaluering"
                    : `Du mangler svar på ${evaluations.length} evalueringer`}
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
                <span>Svar, så kan du melde deg på igjen.</span>
                <div className="flex flex-col gap-2">
                    {evaluations.map((evaluation) => (
                        <Button
                            key={evaluation.formId}
                            size="sm"
                            variant="outline"
                            className="w-full"
                            render={
                                <Link
                                    to="/sporreskjema/$id"
                                    params={{ id: evaluation.formId }}
                                />
                            }
                        >
                            {evaluation.eventTitle}
                        </Button>
                    ))}
                </div>
            </AlertDescription>
        </Alert>
    );
}
