import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MarkdownView } from "@tihlde/ui/complex/markdown";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Separator } from "@tihlde/ui/ui/separator";
import {
    ArrowLeft,
    ArrowUpRight,
    BookOpenCheck,
    CalendarX,
    Globe,
    GraduationCap,
    HandCoins,
    ListChecks,
    type LucideIcon,
    MapPin,
    PencilLine,
    Quote,
} from "lucide-react";
import { z } from "zod";

import { getMasterStudyQuery } from "#/api/queries/master-study";
import { DetailField } from "#/components/detail-field";
import { DetailPage } from "#/components/detail-page";
import { IconActionButton } from "#/components/icon-action-button";
import { richRegistry } from "#/components/markdown/directives/presets";
import { ShareButton } from "#/components/share-button";
import { useAnyScopePermission } from "#/hooks/use-permission";
import {
    LOCATION_TYPE_LABELS,
    MASTER_STUDY_PROGRAM_SLUGS,
    formatApplicationDeadline,
    formatMasterStudyDate,
} from "#/lib/master-study";

const searchSchema = z.object({
    studie: z.enum(MASTER_STUDY_PROGRAM_SLUGS).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/masterveiledning/$id")({
    component: MasterStudyDetailPage,
    validateSearch: searchSchema,
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getMasterStudyQuery(params.id)),
});

function MasterStudyDetailPage() {
    const { id } = Route.useParams();
    const { data: entry } = useSuspenseQuery(getMasterStudyQuery(id));
    const canEdit = useAnyScopePermission([
        "master-study:update",
        "master-study:manage",
    ]);

    // Back to the programme the entry belongs to, so the sidebar selection
    // survives the round trip.
    const backProgram = MASTER_STUDY_PROGRAM_SLUGS.find(
        (slug) => slug === entry.studyProgram.slug,
    );

    const facts: { icon: LucideIcon; title: string; body: string | null }[] = [
        {
            icon: BookOpenCheck,
            title: "Fagkrav",
            body: entry.subjectRequirements,
        },
        {
            icon: ListChecks,
            title: "Øvrige krav",
            body: entry.otherRequirements,
        },
        {
            icon: HandCoins,
            title: "Økonomisk støtte",
            body: entry.hasFinancialSupport ? entry.financialSupport : null,
        },
    ];
    const filledFacts = facts.filter((fact) => fact.body?.trim());

    return (
        <DetailPage
            back={
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        render={
                            <Link
                                to="/masterveiledning"
                                search={{ studie: backProgram }}
                            />
                        }
                    >
                        <ArrowLeft />
                        Masterveiledning
                    </Button>
                </div>
            }
            header={
                <div className="flex items-start justify-between gap-2">
                    <h1 className="text-3xl md:text-4xl">{entry.name}</h1>
                    <div className="flex shrink-0 items-center gap-1">
                        <ShareButton label="Del masterstudie" />
                        {canEdit ? (
                            <IconActionButton
                                icon={PencilLine}
                                label="Rediger masterstudie"
                                render={
                                    <Link
                                        to="/admin/masterveiledning/$studyId"
                                        params={{ studyId: entry.id }}
                                    />
                                }
                            />
                        ) : null}
                    </div>
                </div>
            }
            sidebar={
                <Card>
                    <CardHeader>
                        <CardTitle>Søk på studiet</CardTitle>
                        <CardDescription>
                            <span className="flex items-center gap-1.5">
                                <CalendarX className="size-4" />
                                Frist{" "}
                                {formatApplicationDeadline(
                                    entry.applicationDeadline,
                                )}
                            </span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Button
                            className="w-full"
                            render={
                                <a
                                    href={entry.link}
                                    target="_blank"
                                    rel="noreferrer"
                                />
                            }
                        >
                            Gå til studiets nettside
                            <ArrowUpRight />
                        </Button>
                        <Separator />
                        <DetailField
                            icon={GraduationCap}
                            label="Bygger på"
                            value={entry.studyProgram.displayName}
                        />
                        <DetailField
                            icon={MapPin}
                            label="Sted"
                            value={entry.location}
                        />
                        <DetailField
                            icon={Globe}
                            label="Innland/utland"
                            value={LOCATION_TYPE_LABELS[entry.locationType]}
                        />
                        <DetailField
                            icon={HandCoins}
                            label="Økonomisk støtte"
                            value={entry.hasFinancialSupport ? "Ja" : "Nei"}
                        />
                    </CardContent>
                    <CardFooter>
                        <CardDescription>
                            Oppdatert {formatMasterStudyDate(entry.updatedAt)}
                        </CardDescription>
                    </CardFooter>
                </Card>
            }
            body={
                <>
                    {entry.summary?.trim() ? (
                        <MarkdownView
                            registry={richRegistry}
                            source={entry.summary}
                        />
                    ) : null}

                    {filledFacts.length > 0 ? (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-xl">Opptak og støtte</h2>
                            <dl className="flex flex-col gap-4">
                                {filledFacts.map(
                                    ({ icon: Icon, title, body }, index) => (
                                        <div
                                            key={title}
                                            className="flex flex-col gap-4"
                                        >
                                            {index > 0 ? <Separator /> : null}
                                            <div className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
                                                <dt className="flex items-center gap-2 self-start text-sm text-muted-foreground sm:pt-0.5">
                                                    <Icon className="size-4 shrink-0" />
                                                    {title}
                                                </dt>
                                                <dd>
                                                    <MarkdownView
                                                        registry={richRegistry}
                                                        source={body ?? ""}
                                                    />
                                                </dd>
                                            </div>
                                        </div>
                                    ),
                                )}
                            </dl>
                        </section>
                    ) : null}

                    {entry.quotes.length > 0 ? (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-xl">Erfaringer</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                {entry.quotes.map((quote) => (
                                    <Card key={quote.id} size="sm">
                                        <CardContent className="flex flex-col gap-3">
                                            <Quote className="size-5" />
                                            <blockquote>
                                                {quote.quote}
                                            </blockquote>
                                            <CardDescription>
                                                — {quote.name ?? "Anonym"}
                                            </CardDescription>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </>
            }
        />
    );
}
