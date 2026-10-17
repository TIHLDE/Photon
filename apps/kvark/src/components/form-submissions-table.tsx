import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import { Text } from "@tihlde/ui/ui/text";

import { type FormSubmissionRow, formatSubmissionStudy } from "#/lib/form";

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
            <Text size="sm" tone="muted">
                Ingen har svart på skjemaet ennå.
            </Text>
        );
    }

    // Ett spørsmål er én kolonne, så tabellen blir bredere enn siden. `Table`
    // ruller allerede vannrett selv; svarkolonnene får en makshøyde på bredden
    // slik at et langt fritekstsvar brytes i stedet for å strekke tabellen ut
    // i titusenvis av piksler.
    return (
        <Table className="min-w-max">
            <TableHeader>
                <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Sendt inn</TableHead>
                    {questions.map((question) => (
                        // `whitespace-normal` som i cellene under: uten den
                        // står overskriften på én linje uansett `max-w`, og et
                        // langt spørsmål legger seg oppå nabokolonnen.
                        <TableHead
                            key={question.id}
                            className="max-w-xs whitespace-normal"
                        >
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
                                <Text render={<span />} size="xs" tone="muted">
                                    {submission.userEmail}
                                </Text>
                                {/* Studie og klassetrinn hører til personen,
                                    ikke til et eget spørsmål: skjemaeieren
                                    leser svarene per klassetrinn like ofte som
                                    per navn (#681). */}
                                {formatSubmissionStudy(
                                    submission.studyProgram,
                                    submission.classYear,
                                ) ? (
                                    <Text
                                        render={<span />}
                                        size="xs"
                                        tone="muted"
                                    >
                                        {formatSubmissionStudy(
                                            submission.studyProgram,
                                            submission.classYear,
                                        )}
                                    </Text>
                                ) : null}
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
