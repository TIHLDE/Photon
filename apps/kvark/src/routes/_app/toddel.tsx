import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { Suspense } from "react";
import { Button } from "@tihlde/ui/ui/button";
import { Skeleton } from "@tihlde/ui/ui/skeleton";

import { getToddelIssuesQuery } from "#/api/queries/toddel";
import { IssueCard } from "#/components/issue-card";
import { PageHeader } from "#/components/page-header";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { formatOsloDate } from "#/lib/date";

/** Module-level so the permission lookup keeps a stable identity. */
const TODDEL_CREATE_PERMISSIONS = ["toddel:create", "toddel:manage"] as const;

export const Route = createFileRoute("/_app/toddel")({
    component: ToddelPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getToddelIssuesQuery()),
});

/**
 * "Mai 2025" — the issue carries only a date, and a day nobody remembers reads
 * worse than the month.
 *
 * Deliberately not a semester label: TÖDDEL runs more than one issue per term,
 * and the last four are all titled plainly "Töddel", so "Vår 2025" would print
 * the same caption on two different magazines.
 */
function publishedLabel(publishedAt: string): string {
    const label = formatOsloDate(publishedAt, {
        month: "long",
        year: "numeric",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function IssueGridSkeleton() {
    return (
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
                <li key={index} className="flex flex-col gap-2">
                    <Skeleton className="aspect-[3/4] w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                </li>
            ))}
        </ul>
    );
}

function IssueGrid() {
    const { data: issues } = useSuspenseQuery(getToddelIssuesQuery());

    if (issues.length === 0) {
        return (
            <p className="text-muted-foreground">
                Ingen utgaver er lagt ut ennå.
            </p>
        );
    }

    return (
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {issues.map((issue) => (
                <li key={issue.edition}>
                    <IssueCard
                        title={issue.title}
                        edition={publishedLabel(issue.publishedAt)}
                        coverUrl={issue.imageUrl ?? undefined}
                        pdfUrl={issue.pdfUrl}
                    />
                </li>
            ))}
        </ul>
    );
}

function ToddelPage() {
    // Scopet er ukjent på en offentlig liste, så any-scope er riktig her:
    // et gruppe-scopet toddel:create er en ekte tilgang, og API-et avviser
    // uansett den enkelte forespørselen som ikke treffer.
    const canCreateIssue = useAnyScopePermission(TODDEL_CREATE_PERMISSIONS);

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <PageHeader
                title="TÖDDEL"
                description="Les tidligere utgaver av TIHLDE sitt studentblad"
                action={
                    canCreateIssue ? (
                        <Button
                            render={
                                <Link
                                    to="/admin/toddel"
                                    search={{ ny: true }}
                                />
                            }
                        >
                            <PlusIcon className="size-4" />
                            Ny utgave
                        </Button>
                    ) : null
                }
            />

            <Suspense fallback={<IssueGridSkeleton />}>
                <IssueGrid />
            </Suspense>
        </div>
    );
}
