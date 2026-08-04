import {
    useQuery,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { ArrowLeft, DownloadIcon, LockIcon, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { authClientWithRedirect } from "#/api/auth";
import {
    downloadFormSubmissionsQuery,
    getFormByIdQuery,
    getFormStatisticsQuery,
    getFormSubmissionsQuery,
} from "#/api/queries/forms";
import { FormStatisticsList } from "#/components/form-statistics-list";
import { FormSubmissionsTable } from "#/components/form-submissions-table";
import { useGoBack } from "#/hooks/use-go-back";
import { mapFormStatistics, mapSubmission } from "#/lib/form";
import { errorStatus } from "#/lib/utils";

const searchSchema = z.object({
    visning: z.enum(["svar", "statistikk"]).default("svar").catch("svar"),
});

export const Route = createFileRoute("/_app/sporreskjema/$id_/svar")({
    component: FormSubmissionsPage,
    validateSearch: searchSchema,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getFormByIdQuery(params.id)),
});

function FormSubmissionsPage() {
    const { id } = Route.useParams();
    const { visning } = Route.useSearch();
    const navigate = Route.useNavigate();
    const goBack = useGoBack();
    const queryClient = useQueryClient();
    const [isDownloading, setIsDownloading] = useState(false);

    const { data: form } = useSuspenseQuery(getFormByIdQuery(id));
    // Svarene og statistikken er bare for dem som kan administrere skjemaet.
    // Alle andre får 403, og da vises «ingen tilgang» i stedet for en tom liste.
    const {
        data: apiSubmissions,
        isPending: isLoadingSubmissions,
        error: submissionsError,
    } = useQuery(getFormSubmissionsQuery(id, 0));
    const denied = errorStatus(submissionsError) === 403;
    const { data: apiStatistics } = useQuery({
        ...getFormStatisticsQuery(id),
        enabled: submissionsError === null,
    });

    const submissions = useMemo(
        () => (apiSubmissions ?? []).map(mapSubmission),
        [apiSubmissions],
    );
    const statistics = useMemo(
        () => mapFormStatistics(apiStatistics?.statistics ?? []),
        [apiStatistics],
    );
    const questions = useMemo(
        () =>
            form.fields.map((field) => ({ id: field.id, title: field.title })),
        [form.fields],
    );

    /**
     * CSV-en lages av API-et; her hentes den bare og lagres. Nedlastingen går
     * ikke gjennom en vanlig lenke fordi endepunktet krever innlogging.
     */
    async function handleDownload() {
        setIsDownloading(true);
        try {
            // Endepunktet svarer text/csv, som OpenAPI-skjemaet ikke typer.
            const csv = await queryClient.fetchQuery(
                downloadFormSubmissionsQuery(id),
            );
            const url = URL.createObjectURL(
                new Blob([String(csv)], { type: "text/csv;charset=utf-8" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = `${form.title}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } finally {
            setIsDownloading(false);
        }
    }

    return (
        <div className="container mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12">
            <Button variant="outline" className="self-start" onClick={goBack}>
                <ArrowLeft />
                Tilbake
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">{form.title}</CardTitle>
                    <CardDescription>
                        {form.group ? (
                            <>
                                Spørreskjema fra{" "}
                                <Link
                                    to="/grupper/$slug"
                                    params={{ slug: form.group.slug }}
                                    search={{ tab: "sporreskjema" }}
                                >
                                    {form.group.name}
                                </Link>
                            </>
                        ) : (
                            "Svar på spørreskjemaet"
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    {denied ? (
                        <NoAccess />
                    ) : submissionsError ? (
                        <Alert variant="destructive">
                            <TriangleAlert />
                            <AlertTitle>Klarte ikke å hente svarene</AlertTitle>
                            <AlertDescription>
                                {submissionsError.message}
                            </AlertDescription>
                        </Alert>
                    ) : isLoadingSubmissions ? (
                        <div className="flex flex-col gap-3">
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-32 w-full" />
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-3">
                                <Tabs
                                    value={visning}
                                    onValueChange={(v) =>
                                        navigate({
                                            search: {
                                                visning: v as
                                                    | "svar"
                                                    | "statistikk",
                                            },
                                        })
                                    }
                                >
                                    <TabsList>
                                        <TabsTrigger value="svar">
                                            {submissions.length} svar
                                        </TabsTrigger>
                                        <TabsTrigger value="statistikk">
                                            Statistikk
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                <Button
                                    variant="outline"
                                    className="ml-auto"
                                    disabled={
                                        isDownloading ||
                                        submissions.length === 0
                                    }
                                    onClick={handleDownload}
                                >
                                    <DownloadIcon />
                                    Last ned som CSV
                                </Button>
                            </div>
                            {visning === "svar" ? (
                                <FormSubmissionsTable
                                    questions={questions}
                                    submissions={submissions}
                                />
                            ) : (
                                <FormStatisticsList statistics={statistics} />
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function NoAccess() {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <LockIcon />
                </EmptyMedia>
                <EmptyTitle>Ingen tilgang til svarene</EmptyTitle>
                <EmptyDescription>
                    Bare lederen av gruppen som eier skjemaet kan se svarene.
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}
