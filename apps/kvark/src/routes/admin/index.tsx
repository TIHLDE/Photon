import { CatchBoundary, createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
    BriefcaseBusinessIcon,
    CalendarIcon,
    FileSignatureIcon,
    NewspaperIcon,
    PlusIcon,
    Users2Icon,
} from "lucide-react";
import { Suspense } from "react";

import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Skeleton } from "@tihlde/ui/ui/skeleton";

import { Stagger } from "@tihlde/ui/ui/motion";

import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { AdminStatCard } from "#/components/admin-stat-card";
import { getContractListQuery } from "#/api/queries/contracts";
import { getEventsQuery } from "#/api/queries/events";
import { getGroupsQuery } from "#/api/queries/groups";
import { getJobsQuery } from "#/api/queries/jobs";
import { getNewsQuery } from "#/api/queries/news";
import { SectionError } from "#/components/section-error";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { ADMIN_SECTION_PERMISSIONS } from "#/lib/admin-sections";
import { formatInOslo } from "#/lib/date";

export const Route = createFileRoute("/admin/")({
    component: DashboardPage,
    // Dashbordet er en samling uavhengige widgeter, og ingen av dem er sida.
    // Derfor blokkerer loaderen ikke på noe: hver widget henter selv bak sin
    // egen Suspense- og feilgrense, så ett feilende endepunkt koster oss den
    // ene widgeten. Tidligere prefetchet loaderen alt under ett `Promise.all`,
    // og da tok `/api/contracts` med seg hele dashbordet for alle uten
    // `contracts:view` — se `ContractsStatCard`, som fortsatt er skilt ut for
    // at den spørringen ikke skal kjøre for andre i det hele tatt.
    loader: () => ({ breadcrumbs: "Dashboard" }),
});

function DashboardPage() {
    const canCreateEvents = useAnyScopePermission([
        "events:create",
        "events:manage",
    ]);

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title="Dashboard"
                description="Oversikt over innhold og administrasjon i Kvark."
                action={
                    canCreateEvents ? (
                        <Button render={<Link to="/admin/arrangementer/ny" />}>
                            <PlusIcon className="size-4" />
                            Nytt arrangement
                        </Button>
                    ) : null
                }
            />

            <CatchBoundary
                getResetKey={() => "stats"}
                errorComponent={() => (
                    <SectionError message="Vi fikk ikke lastet tallene." />
                )}
            >
                <Suspense fallback={<StatsSkeleton />}>
                    <StatsGrid />
                </Suspense>
            </CatchBoundary>

            <QuickActions />

            <div className="grid gap-6 lg:grid-cols-2">
                <CatchBoundary
                    getResetKey={() => "recent-events"}
                    errorComponent={() => (
                        <CardError title="Siste arrangementer" />
                    )}
                >
                    <Suspense fallback={<ListCardSkeleton />}>
                        <RecentEvents />
                    </Suspense>
                </CatchBoundary>
                <CatchBoundary
                    getResetKey={() => "recent-news"}
                    errorComponent={() => <CardError title="Siste nyheter" />}
                >
                    <Suspense fallback={<ListCardSkeleton />}>
                        <RecentNews />
                    </Suspense>
                </CatchBoundary>
            </div>
        </Stagger>
    );
}

/**
 * Feilet innhold i et av korta i rutenettet. Kortet beholder tittelen og
 * plassen sin, så resten av dashbordet ikke hopper.
 */
function CardError({ title }: { title: string }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <SectionError message="Vi fikk ikke lastet dette." />
            </CardContent>
        </Card>
    );
}

function StatsGrid() {
    const { data: events } = useSuspenseQuery(getEventsQuery(0));
    const { data: news } = useSuspenseQuery(getNewsQuery(0));
    const { data: jobs } = useSuspenseQuery(getJobsQuery(0));
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));

    // The cards are links into the admin sections, so they follow the same
    // rule as the sidebar: no entry point to a section you cannot open.
    const canEvents = useAnyScopePermission(
        ADMIN_SECTION_PERMISSIONS.arrangementer,
    );
    const canNews = useAnyScopePermission(ADMIN_SECTION_PERMISSIONS.nyheter);
    const canJobs = useAnyScopePermission(ADMIN_SECTION_PERMISSIONS.annonser);
    const canGroups = useAnyScopePermission(ADMIN_SECTION_PERMISSIONS.grupper);
    const canContracts = useAnyScopePermission(
        ADMIN_SECTION_PERMISSIONS.opptak,
    );

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {canEvents ? (
                <AdminStatCard
                    label="Arrangementer"
                    value={events.totalCount}
                    icon={CalendarIcon}
                    link={{ to: "/admin/arrangementer" }}
                />
            ) : null}
            {canNews ? (
                <AdminStatCard
                    label="Nyheter"
                    value={news.totalCount}
                    icon={NewspaperIcon}
                    link={{ to: "/admin/nyheter" }}
                />
            ) : null}
            {canJobs ? (
                <AdminStatCard
                    label="Annonser"
                    value={jobs.totalCount}
                    icon={BriefcaseBusinessIcon}
                    link={{ to: "/admin/annonser" }}
                />
            ) : null}
            {canGroups ? (
                <AdminStatCard
                    label="Grupper"
                    value={groups.length}
                    icon={Users2Icon}
                    link={{ to: "/admin/grupper" }}
                />
            ) : null}
            {/* Own component: the contracts endpoint 403s without
                contracts:view, so the query must not run at all for others. */}
            {canContracts ? <ContractsStatCard /> : null}
        </div>
    );
}

function ContractsStatCard() {
    const { data: contracts } = useSuspenseQuery(getContractListQuery());

    return (
        <AdminStatCard
            label="Kontrakter"
            value={contracts.length}
            icon={FileSignatureIcon}
            hint={
                contracts.some((contract) => contract.isActive)
                    ? "Én aktiv kontrakt"
                    : "Ingen aktiv kontrakt"
            }
            link={{ to: "/admin/opptak" }}
        />
    );
}

function QuickActions() {
    const canCreateNews = useAnyScopePermission(
        ADMIN_SECTION_PERMISSIONS.nyheter,
    );
    const canCreateJobs = useAnyScopePermission(["jobs:create", "jobs:manage"]);
    const canUploadContract = useAnyScopePermission([
        "contracts:create",
        "contracts:manage",
    ]);
    const canManageGroups = useAnyScopePermission(
        ADMIN_SECTION_PERMISSIONS.grupper,
    );

    if (
        !canCreateNews &&
        !canCreateJobs &&
        !canUploadContract &&
        !canManageGroups
    ) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Hurtighandlinger</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
                {canCreateNews ? (
                    <Button
                        variant="outline"
                        render={
                            <Link to="/admin/nyheter" search={{ ny: true }} />
                        }
                    >
                        <NewspaperIcon className="size-4" />
                        Ny nyhet
                    </Button>
                ) : null}
                {canCreateJobs ? (
                    <Button
                        variant="outline"
                        render={
                            <Link to="/admin/annonser" search={{ ny: true }} />
                        }
                    >
                        <BriefcaseBusinessIcon className="size-4" />
                        Ny annonse
                    </Button>
                ) : null}
                {canUploadContract ? (
                    <Button
                        variant="outline"
                        render={<Link to="/admin/opptak" />}
                    >
                        <FileSignatureIcon className="size-4" />
                        Last opp kontrakt
                    </Button>
                ) : null}
                {canManageGroups ? (
                    <Button
                        variant="outline"
                        render={<Link to="/admin/grupper" />}
                    >
                        <Users2Icon className="size-4" />
                        Administrer grupper
                    </Button>
                ) : null}
            </CardContent>
        </Card>
    );
}

function RecentEvents() {
    const { data: events } = useSuspenseQuery(getEventsQuery(0));
    const recent = events.items.slice(0, 5);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Siste arrangementer</CardTitle>
            </CardHeader>
            <CardContent>
                {recent.length === 0 ? (
                    <AdminEmptyState
                        icon={CalendarIcon}
                        title="Ingen arrangementer ennå"
                    />
                ) : (
                    <ul className="flex flex-col divide-y">
                        {recent.map((event) => (
                            <li
                                key={event.id}
                                className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                            >
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate">
                                        {event.title}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {event.organizer?.name ?? "Ukjent"}
                                    </span>
                                </div>
                                <span className="shrink-0 text-sm text-muted-foreground">
                                    {formatDate(event.startTime)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}

function RecentNews() {
    const { data: news } = useSuspenseQuery(getNewsQuery(0));
    const recent = news.items.slice(0, 5);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Siste nyheter</CardTitle>
            </CardHeader>
            <CardContent>
                {recent.length === 0 ? (
                    <AdminEmptyState
                        icon={NewspaperIcon}
                        title="Ingen nyheter ennå"
                    />
                ) : (
                    <ul className="flex flex-col divide-y">
                        {recent.map((article) => (
                            <li
                                key={article.id}
                                className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                            >
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate">
                                        {article.title}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {article.header}
                                    </span>
                                </div>
                                <span className="shrink-0 text-sm text-muted-foreground">
                                    {formatDate(article.createdAt)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}

function formatDate(iso: string): string {
    return formatInOslo(iso, "d. MMM yyyy");
}

function StatsSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
            ))}
        </div>
    );
}

function ListCardSkeleton() {
    return <Skeleton className="h-64 w-full" />;
}
