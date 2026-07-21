import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { Skeleton } from "@tihlde/ui/ui/skeleton";

import { getToddelIssuesQuery } from "#/api/queries/toddel";
import { IssueCard } from "#/components/issue-card";

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
    const label = new Date(publishedAt).toLocaleDateString("nb-NO", {
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
    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">TÖDDEL</h1>
                <p className="text-muted-foreground">
                    Les tidligere utgaver av TIHLDE sitt studentblad
                </p>
            </div>

            <Suspense fallback={<IssueGridSkeleton />}>
                <IssueGrid />
            </Suspense>
        </div>
    );
}
