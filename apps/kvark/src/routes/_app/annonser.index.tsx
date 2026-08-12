import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import { Stagger } from "@tihlde/ui/ui/motion";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { getJobsQuery } from "#/api/queries/jobs";
import { JobCard } from "#/components/job-card";
import {
    DEFAULT_JOB_FILTERS,
    JobFilters,
    type JobFiltersValue,
    type JobType,
} from "#/components/job-filters";
import { PageHeader } from "#/components/page-header";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { formatClassRange, formatJobDeadline, formatJobType } from "#/lib/job";

/** Module-level so the permission lookup keeps a stable identity. */
const JOB_CREATE_PERMISSIONS = ["jobs:create", "jobs:manage"] as const;

export const Route = createFileRoute("/_app/annonser/")({
    component: JobsPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getJobsQuery(0)),
});

const CLASS_LEVELS = [
    { value: 1, label: "1. klasse" },
    { value: 2, label: "2. klasse" },
    { value: 3, label: "3. klasse" },
    { value: 4, label: "4. klasse" },
    { value: 5, label: "5. klasse" },
];

const JOB_TYPES: { value: JobType; label: string }[] = [
    { value: "sommerjobb", label: "Sommerjobb" },
    { value: "deltid", label: "Deltid" },
    { value: "fulltid", label: "Fulltid" },
    { value: "annet", label: "Annet" },
];

function JobsPage() {
    const [filters, setFilters] =
        useState<JobFiltersValue>(DEFAULT_JOB_FILTERS);

    const { data } = useSuspenseQuery(getJobsQuery(0));
    const jobs = data.items;
    // Any-scope: scopet er ukjent på en offentlig liste, og API-et avviser
    // uansett den enkelte forespørselen som ikke treffer.
    const canCreateJob = useAnyScopePermission(JOB_CREATE_PERMISSIONS);

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <PageHeader
                title="Stillingsannonser"
                description="Finn relevante jobber for studenter"
                action={
                    canCreateJob ? (
                        <Button
                            render={
                                <Link
                                    to="/admin/annonser"
                                    search={{ ny: true }}
                                />
                            }
                        >
                            <PlusIcon className="size-4" />
                            Ny annonse
                        </Button>
                    ) : null
                }
            />

            <div className="grid gap-6 md:grid-cols-[20rem_minmax(0,1fr)]">
                <aside>
                    <JobFilters
                        value={filters}
                        classLevelOptions={CLASS_LEVELS}
                        jobTypeOptions={JOB_TYPES}
                        onChange={setFilters}
                    />
                </aside>

                <section className="flex min-w-0 flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                        {data.totalCount} stillinger funnet
                    </p>
                    <Stagger
                        render={<ul className="flex flex-col gap-4 sm:gap-1" />}
                    >
                        {jobs.map((job) => (
                            <li key={job.id}>
                                <JobCard
                                    slug={job.id}
                                    title={job.title}
                                    jobType={formatJobType(job.jobType)}
                                    classLevels={formatClassRange(
                                        job.classStart,
                                        job.classEnd,
                                    )}
                                    location={job.location}
                                    deadline={formatJobDeadline(
                                        job.deadline,
                                        job.isContinuouslyHiring,
                                    )}
                                    imageUrl={job.imageUrl || undefined}
                                />
                            </li>
                        ))}
                    </Stagger>
                </section>
            </div>
        </div>
    );
}
