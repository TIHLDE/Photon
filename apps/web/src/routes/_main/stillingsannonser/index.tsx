import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Briefcase } from "lucide-react";
import { Suspense, useCallback } from "react";
import { z } from "zod";
import { EmptyState } from "~/components/empty-state";
import { JobPostCard } from "~/components/job-post-card";
import { JobPostCardSkeleton } from "~/components/job-post-card-skeleton";
import { Page } from "~/components/layout/page";
import { SearchInput } from "~/components/search-input";
import { listJobsQuery } from "~/lib/queries/jobs";

const searchSchema = z.object({
    search: z.string().optional().catch(undefined),
    expired: z.boolean().optional().catch(undefined),
    jobType: z
        .enum(["full_time", "part_time", "summer_job", "other"])
        .optional()
        .catch(undefined),
});

export const Route = createFileRoute("/_main/stillingsannonser/")({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }) =>
        context.queryClient.ensureQueryData(listJobsQuery(deps)),
    component: JobsPage,
});

function JobsPage() {
    const { search, expired, jobType } = Route.useSearch();
    const navigate = useNavigate({ from: Route.fullPath });

    const setSearch = useCallback(
        (value: string) =>
            navigate({
                search: (prev) => ({
                    ...prev,
                    search: value || undefined,
                }),
            }),
        [navigate],
    );

    const toggleExpired = useCallback(
        () =>
            navigate({
                search: (prev) => ({
                    ...prev,
                    expired: prev.expired ? undefined : true,
                }),
            }),
        [navigate],
    );

    const setJobType = useCallback(
        (type: string | undefined) =>
            navigate({
                search: (prev) => ({
                    ...prev,
                    jobType: type as typeof jobType,
                }),
            }),
        [navigate],
    );

    return (
        <Page>
            <div className="space-y-6">
                <div>
                    <h1 className="font-heading text-3xl font-bold">
                        Stillingsannonser
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Finn relevante stillinger og karrieremuligheter
                    </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex-1">
                        <SearchInput
                            value={search ?? ""}
                            onChange={setSearch}
                            placeholder="Søk etter stillinger..."
                        />
                    </div>
                    <div className="flex gap-2">
                        {(
                            [
                                ["full_time", "Fulltid"],
                                ["part_time", "Deltid"],
                                ["summer_job", "Sommerjobb"],
                            ] as const
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() =>
                                    setJobType(
                                        jobType === value ? undefined : value,
                                    )
                                }
                                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                                    jobType === value
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={toggleExpired}
                            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                                expired
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Utløpte
                        </button>
                    </div>
                </div>

                <Suspense fallback={<JobsListSkeleton />}>
                    <JobsList
                        search={search}
                        expired={expired}
                        jobType={jobType}
                    />
                </Suspense>
            </div>
        </Page>
    );
}

function JobsList({
    search,
    expired,
    jobType,
}: {
    search?: string;
    expired?: boolean;
    jobType?: "full_time" | "part_time" | "summer_job" | "other";
}) {
    const { data } = useSuspenseQuery(
        listJobsQuery({ search, expired, jobType }),
    );

    if (!data || data.items.length === 0) {
        return (
            <EmptyState
                icon={Briefcase}
                title="Ingen stillinger funnet"
                description={
                    search
                        ? "Prøv å endre søket ditt"
                        : "Det er ingen stillingsannonser å vise akkurat nå"
                }
            />
        );
    }

    return (
        <div className="space-y-3">
            {data.items.map((job) => (
                <JobPostCard key={job.id} job={job} />
            ))}
        </div>
    );
}

function JobsListSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <JobPostCardSkeleton key={i} />
            ))}
        </div>
    );
}
