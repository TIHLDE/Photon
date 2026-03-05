import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { Suspense } from "react";
import { FormBuilder } from "~/components/admin/form-builder";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import {
    getFormQuery,
    getFormStatisticsQuery,
    listFormSubmissionsQuery,
} from "~/lib/queries/forms";

export const Route = createFileRoute("/_main/admin/skjemaer/$formId")({
    loader: ({ context, params }) =>
        Promise.all([
            context.queryClient.ensureQueryData(getFormQuery(params.formId)),
            context.queryClient.ensureQueryData(
                listFormSubmissionsQuery(params.formId),
            ),
        ]),
    component: EditFormPage,
});

function EditFormPage() {
    const { formId } = Route.useParams();
    const { data: form } = useSuspenseQuery(getFormQuery(formId));

    if (!form) return null;

    return (
        <div className="space-y-6">
            <h1 className="font-heading text-2xl font-bold">
                Rediger: {form.title}
            </h1>

            <FormBuilder
                formId={formId}
                initialData={{
                    title: form.title,
                    description: form.description ?? undefined,
                    template: form.template,
                    fields: form.fields.map((f, i) => ({
                        id: f.id,
                        title: f.title,
                        type: f.type,
                        required: f.required,
                        order: f.order ?? i,
                        options: f.options.map((o, j) => ({
                            id: o.id,
                            title: o.title,
                            order: o.order ?? j,
                        })),
                    })),
                }}
            />

            <Separator />

            <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                <FormSubmissions formId={formId} />
            </Suspense>

            <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                <FormStatistics formId={formId} />
            </Suspense>
        </div>
    );
}

function FormSubmissions({ formId }: { formId: string }) {
    const { data: submissions } = useSuspenseQuery(
        listFormSubmissionsQuery(formId),
    );

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Besvarelser ({submissions?.length ?? 0})</CardTitle>
                <a
                    href={`/api/forms/${formId}/submissions/download`}
                    target="_blank"
                    rel="noreferrer"
                >
                    <Button variant="outline" size="sm">
                        <Download className="mr-1 size-3.5" />
                        Last ned CSV
                    </Button>
                </a>
            </CardHeader>
            <CardContent>
                {!submissions || submissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Ingen besvarelser enda.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Bruker</TableHead>
                                <TableHead>E-post</TableHead>
                                <TableHead>Svar</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {submissions.map((sub) => (
                                <TableRow key={sub.id}>
                                    <TableCell className="font-medium">
                                        {sub.user.name}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {sub.user.email}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {sub.answers.length} svar
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

function FormStatistics({ formId }: { formId: string }) {
    const { data } = useSuspenseQuery(getFormStatisticsQuery(formId));

    if (!data) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Statistikk</CardTitle>
            </CardHeader>
            <CardContent>
                <pre className="overflow-auto rounded bg-muted p-3 text-xs">
                    {JSON.stringify(data, null, 2)}
                </pre>
            </CardContent>
        </Card>
    );
}
