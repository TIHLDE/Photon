import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
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

import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { AdminStatCard } from "#/components/admin-stat-card";
import { getContractListQuery } from "#/api/queries/contracts";
import { getEventsQuery } from "#/api/queries/events";
import { getGroupsQuery } from "#/api/queries/groups";
import { getJobsQuery } from "#/api/queries/jobs";
import { getNewsQuery } from "#/api/queries/news";

export const Route = createFileRoute("/admin/")({
    component: DashboardPage,
    loader: async ({ context }) => {
        await Promise.all([
            context.queryClient.ensureQueryData(getEventsQuery(0)),
            context.queryClient.ensureQueryData(getNewsQuery(0)),
            context.queryClient.ensureQueryData(getJobsQuery(0)),
            context.queryClient.ensureQueryData(getGroupsQuery(0)),
            context.queryClient.ensureQueryData(getContractListQuery()),
        ]);
        return { breadcrumbs: "Dashboard" };
    },
});

function DashboardPage() {
    return (
        <div className="container mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
            <AdminPageHeader
                title="Dashboard"
                description="Oversikt over innhold og administrasjon i Kvark."
                action={
                    <Button render={<Link to="/admin/arrangementer" />}>
                        <PlusIcon className="size-4" />
                        Nytt arrangement
                    </Button>
                }
            />

            <Suspense fallback={<StatsSkeleton />}>
                <StatsGrid />
            </Suspense>

            <QuickActions />

            <div className="grid gap-6 lg:grid-cols-2">
                <Suspense fallback={<ListCardSkeleton />}>
                    <RecentEvents />
                </Suspense>
                <Suspense fallback={<ListCardSkeleton />}>
                    <RecentNews />
                </Suspense>
            </div>
        </div>
    );
}

function StatsGrid() {
    const { data: events } = useSuspenseQuery(getEventsQuery(0));
    const { data: news } = useSuspenseQuery(getNewsQuery(0));
    const { data: jobs } = useSuspenseQuery(getJobsQuery(0));
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));
    const { data: contracts } = useSuspenseQuery(getContractListQuery());

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminStatCard
                label="Arrangementer"
                value={events.totalCount}
                icon={CalendarIcon}
                link={{ to: "/admin/arrangementer" }}
            />
            <AdminStatCard
                label="Nyheter"
                value={news.totalCount}
                icon={NewspaperIcon}
                link={{ to: "/admin/nyheter" }}
            />
            <AdminStatCard
                label="Annonser"
                value={jobs.totalCount}
                icon={BriefcaseBusinessIcon}
                link={{ to: "/admin/annonser" }}
            />
            <AdminStatCard
                label="Grupper"
                value={groups.length}
                icon={Users2Icon}
                link={{ to: "/admin/grupper" }}
            />
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
        </div>
    );
}

function QuickActions() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Hurtighandlinger</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
                <Button variant="outline" render={<Link to="/admin/nyheter" />}>
                    <NewspaperIcon className="size-4" />
                    Ny nyhet
                </Button>
                <Button
                    variant="outline"
                    render={<Link to="/admin/annonser" />}
                >
                    <BriefcaseBusinessIcon className="size-4" />
                    Ny annonse
                </Button>
                <Button variant="outline" render={<Link to="/admin/opptak" />}>
                    <FileSignatureIcon className="size-4" />
                    Last opp kontrakt
                </Button>
                <Button variant="outline" render={<Link to="/admin/grupper" />}>
                    <Users2Icon className="size-4" />
                    Administrer grupper
                </Button>
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
    return format(new Date(iso), "d. MMM yyyy", { locale: nb });
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
