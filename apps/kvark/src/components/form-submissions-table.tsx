import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";

import type { FormSubmissionRow } from "#/lib/form";

type FormSubmissionsTableProps = {
    /** Spørsmålene, i skjemaets rekkefølge. Én kolonne hver. */
    questions: { id: string; title: string }[];
    submissions: FormSubmissionRow[];
};

export function FormSubmissionsTable({
    questions,
    submissions,
}: FormSubmissionsTableProps) {
    if (submissions.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Ingen har svart på skjemaet ennå.
            </p>
        );
    }

    // Ett spørsmål er én kolonne, så tabellen blir bredere enn siden. `Table`
    // ruller allerede vannrett selv; svarkolonnene får en makshøyde på bredden
    // slik at et langt fritekstsvar brytes i stedet for å strekke tabellen ut
    // i titusenvis av piksler.
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Sendt inn</TableHead>
                    {questions.map((question) => (
                        <TableHead key={question.id} className="max-w-xs">
                            {question.title}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {submissions.map((submission) => (
                    <TableRow key={submission.id}>
                        <TableCell>
                            <div className="flex flex-col">
                                <span>{submission.userName}</span>
                                <span className="text-xs text-muted-foreground">
                                    {submission.userEmail}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell>{submission.submittedAt}</TableCell>
                        {questions.map((question) => (
                            <TableCell
                                key={question.id}
                                className="max-w-xs whitespace-normal"
                            >
                                {submission.answers.find(
                                    (answer) => answer.fieldId === question.id,
                                )?.text ?? ""}
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
