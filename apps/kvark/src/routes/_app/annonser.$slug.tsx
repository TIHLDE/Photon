import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
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

import { getJobByIdQuery } from "#/api/queries/jobs";
import { useCanActOnResource } from "#/hooks/use-permission";
import { DetailField } from "#/components/detail-field";
import { DetailHero } from "#/components/detail-hero";
import { DetailIdentity } from "#/components/detail-identity";
import { DetailPage } from "#/components/detail-page";
import { DetailsCard } from "#/components/details-card";
import { IconActionButton } from "#/components/icon-action-button";
import { ShareButton } from "#/components/share-button";
import { richRegistry } from "#/components/markdown/directives/presets";
import {
    formatClassRange,
    formatJobDate,
    formatJobDeadline,
    formatJobType,
} from "#/lib/job";

export const Route = createFileRoute("/_app/annonser/$slug")({
    component: JobDetailPage,
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getJobByIdQuery(params.slug)),
});

function JobDetailPage() {
    const { slug } = Route.useParams();

    const { data: job } = useSuspenseQuery(getJobByIdQuery(slug));
    // Same rule as the API: the permission, or having created the posting.
    const canEdit = useCanActOnResource(["jobs:update", "jobs:manage"])(
        job.createdById,
    );

    const applyUrl =
        job.link || (job.email ? `mailto:${job.email}` : undefined);

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
            hero={<DetailHero imageUrl={job.imageUrl || undefined} />}
            header={
                <>
                    <div className="flex items-center justify-between gap-2">
                        <DetailIdentity name={job.company} />
                        <div className="flex items-center gap-1">
                            <ShareButton label="Del stilling" />
                            {canEdit ? (
                                <IconActionButton
                                    icon={PencilLine}
                                    label="Rediger annonse"
                                />
                            ) : null}
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl">{job.title}</h1>
                    <DetailField
                        icon={CalendarDays}
                        value={`Publisert ${formatJobDate(job.createdAt)}`}
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
                                    Frist{" "}
                                    {formatJobDeadline(
                                        job.deadline,
                                        job.isContinuouslyHiring,
                                    )}
                                </span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                className="w-full"
                                disabled={!applyUrl}
                                render={
                                    applyUrl ? (
                                        <a
                                            href={applyUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                        />
                                    ) : undefined
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
                                value={formatClassRange(
                                    job.classStart,
                                    job.classEnd,
                                )}
                            />,
                            <DetailField
                                icon={Briefcase}
                                label="Type"
                                value={formatJobType(job.jobType)}
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
