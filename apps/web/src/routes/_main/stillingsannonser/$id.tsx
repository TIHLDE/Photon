import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
    ArrowLeft,
    Building2,
    Calendar,
    ExternalLink,
    Mail,
    MapPin,
} from "lucide-react";
import { Page } from "~/components/layout/page";
import { MarkdownRenderer } from "~/components/markdown-renderer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatDate } from "~/lib/date";
import { getJobQuery } from "~/lib/queries/jobs";

const JOB_TYPE_LABELS: Record<string, string> = {
    full_time: "Fulltid",
    part_time: "Deltid",
    summer_job: "Sommerjobb",
    other: "Annet",
};

const CLASS_LABELS: Record<string, string> = {
    first: "1. klasse",
    second: "2. klasse",
    third: "3. klasse",
    fourth: "4. klasse",
    fifth: "5. klasse",
    alumni: "Alumni",
};

export const Route = createFileRoute("/_main/stillingsannonser/$id")({
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getJobQuery(params.id)),
    component: JobDetailPage,
});

function JobDetailPage() {
    const { id } = Route.useParams();
    const { data: job } = useSuspenseQuery(getJobQuery(id));

    if (!job) return null;

    return (
        <Page>
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="space-y-6">
                    <a
                        href="/stillingsannonser"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="size-4" />
                        Tilbake til stillingsannonser
                    </a>

                    <header className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                                {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                            </Badge>
                            {job.expired && (
                                <Badge
                                    variant="outline"
                                    className="text-muted-foreground"
                                >
                                    Utløpt
                                </Badge>
                            )}
                        </div>
                        <h1 className="font-heading text-3xl font-bold md:text-4xl">
                            {job.title}
                        </h1>
                        {job.ingress && (
                            <p className="text-lg text-muted-foreground">
                                {job.ingress}
                            </p>
                        )}
                    </header>

                    <MarkdownRenderer content={job.body} />
                </div>

                <aside className="space-y-4">
                    <Card>
                        {job.imageUrl && (
                            <div className="flex justify-center px-6 pt-6">
                                <img
                                    src={job.imageUrl}
                                    alt={job.imageAlt ?? job.company}
                                    className="h-20 object-contain"
                                />
                            </div>
                        )}
                        <CardHeader>
                            <CardTitle>{job.company}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            {job.location && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <MapPin className="size-4" />
                                    {job.location}
                                </div>
                            )}
                            {job.deadline && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="size-4" />
                                    Frist: {formatDate(job.deadline)}
                                </div>
                            )}
                            {job.isContinuouslyHiring && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Building2 className="size-4" />
                                    Fortløpende opptak
                                </div>
                            )}
                            <div className="text-muted-foreground">
                                For {CLASS_LABELS[job.classStart]} -{" "}
                                {CLASS_LABELS[job.classEnd]}
                            </div>
                            {job.email && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Mail className="size-4" />
                                    <a
                                        href={`mailto:${job.email}`}
                                        className="text-primary hover:underline"
                                    >
                                        {job.email}
                                    </a>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {job.link && (
                        <a
                            href={job.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                        >
                            <Button className="w-full">
                                Søk stillingen
                                <ExternalLink className="size-4" />
                            </Button>
                        </a>
                    )}
                </aside>
            </div>
        </Page>
    );
}
