import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Separator } from "@tihlde/ui/ui/separator";
import { MarkdownView } from "@tihlde/ui/complex/markdown";
import {
    ArrowLeft,
    ArrowUpRight,
    Briefcase,
    CalendarDays,
    CalendarX,
    GraduationCap,
    MapPin,
    PencilLine,
} from "lucide-react";

import { DetailField } from "#/components/detail-field";
import { DetailHero } from "#/components/detail-hero";
import { DetailIdentity } from "#/components/detail-identity";
import { DetailPage } from "#/components/detail-page";
import { DetailsCard } from "#/components/details-card";
import { IconActionButton } from "#/components/icon-action-button";
import { ShareButton } from "#/components/share-button";
import { richRegistry } from "#/components/markdown/directives/presets";
import { getJobBySlug } from "#/mock/jobs";

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

    return (
        <DetailPage
            back={
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
            }
            hero={<DetailHero imageUrl={job.imageUrl} />}
            header={
                <>
                    <div className="flex items-center justify-between gap-2">
                        <DetailIdentity
                            name={job.company}
                            logoUrl={job.companyLogoUrl}
                        />
                        <div className="flex items-center gap-1">
                            <ShareButton label="Del stilling" />
                            <IconActionButton
                                icon={PencilLine}
                                label="Rediger annonse"
                            />
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl">{job.title}</h1>
                    <DetailField
                        icon={CalendarDays}
                        value={`Publisert ${job.publishedAt}`}
                    />
                </>
            }
            sidebar={
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Søk på stillingen</CardTitle>
                            <CardDescription>
                                <span className="flex items-center gap-1.5">
                                    <CalendarX className="size-4" />
                                    Frist {job.deadlineAbsolute}
                                </span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
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

                    <DetailsCard
                        title="Detaljer"
                        items={[
                            <DetailField
                                icon={GraduationCap}
                                label="Årstrinn"
                                value={job.classLevels}
                            />,
                            <DetailField
                                icon={Briefcase}
                                label="Type"
                                value={job.jobType}
                            />,
                            <DetailField
                                icon={MapPin}
                                label="Sted"
                                value={job.location}
                            />,
                        ]}
                    />
                </>
            }
            body={
                <>
                    <Separator />
                    <MarkdownView registry={richRegistry} source={job.body} />
                </>
            }
        />
    );
}
