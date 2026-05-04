import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Separator } from "@tihlde/ui/ui/separator";
import { MarkdownView } from "@tihlde/ui/complex/markdown";
import {
    ArrowLeft,
    ArrowUpRight,
    Briefcase,
    Building2,
    CalendarDays,
    CalendarX,
    GraduationCap,
    MapPin,
    PencilLine,
} from "lucide-react";

import {
    DetailMetaList,
    type DetailMetaItem,
} from "#/components/detail-meta-list";
import { ShareButton } from "#/components/share-button";
import { richRegistry } from "#/components/markdown/directives/presets";
import { getJobBySlug } from "#/data/jobs";

export const Route = createFileRoute("/_app/annonser/$slug")({
    component: JobDetailPage,
    loader: ({ params }) => {
        const job = getJobBySlug(params.slug);
        if (!job) throw notFound();
        return { job };
    },
});

function JobDetailPage() {
    const { job } = Route.useLoaderData();

    const meta: DetailMetaItem[] = [
        { icon: Building2, label: "Bedrift", value: job.company },
        {
            icon: CalendarX,
            label: "Søknadsfrist",
            value: job.deadlineAbsolute,
        },
        { icon: GraduationCap, label: "Årstrinn", value: job.classLevels },
        { icon: Briefcase, label: "Stillingstype", value: job.jobType },
        { icon: MapPin, label: "Sted", value: job.location },
    ];

    return (
        <article className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:py-10">
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    render={<Link to="/annonser" />}
                >
                    <ArrowLeft />
                    Alle stillinger
                </Button>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
                <div className="flex flex-col gap-6">
                    <div className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-xl border bg-muted">
                        {job.logoUrl ? (
                            <img
                                src={job.logoUrl}
                                alt={job.company}
                                className="size-full object-contain p-12"
                            />
                        ) : (
                            <span className="text-4xl text-muted-foreground">
                                {job.company}
                            </span>
                        )}
                    </div>

                    <header className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Badge variant="secondary" className="w-fit">
                                {job.jobType}
                            </Badge>
                            <h1 className="text-3xl md:text-4xl">
                                {job.title}
                            </h1>
                            <p className="text-muted-foreground">
                                {job.company}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <CalendarDays className="size-4" />
                                Publisert {job.publishedAt}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <CalendarX className="size-4" />
                                Søknadsfrist {job.deadline}
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm">
                                <PencilLine />
                                Rediger annonse
                            </Button>
                            <ShareButton label="Del stilling" />
                        </div>
                    </header>

                    <Separator />

                    <MarkdownView registry={richRegistry} source={job.body} />
                </div>

                <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
                    <Card>
                        <CardHeader>
                            <CardTitle>Detaljer</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <DetailMetaList items={meta} />
                            <Button
                                className="w-full"
                                render={
                                    <a
                                        href={job.applyUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    />
                                }
                            >
                                Søk på stilling
                                <ArrowUpRight />
                            </Button>
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </article>
    );
}
