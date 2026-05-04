import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { JobCard } from "#/components/job-card";
import {
    JobFilters,
    type JobFiltersValue,
    type JobType,
} from "#/components/job-filters";
import { JOBS } from "#/data/jobs";

export const Route = createFileRoute("/_app/annonser/")({
    component: JobsPage,
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
    const [filters, setFilters] = useState<JobFiltersValue>({
        query: "",
        classLevels: [],
        jobType: null,
    });

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Stillingsannonser</h1>
                <p className="text-muted-foreground">
                    Finn relevante jobber for studenter
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-[20rem_1fr]">
                <aside>
                    <JobFilters
                        value={filters}
                        classLevelOptions={CLASS_LEVELS}
                        jobTypeOptions={JOB_TYPES}
                        onChange={setFilters}
                        onSubmit={() => {}}
                    />
                </aside>

                <section className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                        {JOBS.length} stillinger funnet
                    </p>
                    <ul className="flex flex-col gap-3">
                        {JOBS.map((job) => (
                            <li key={job.slug}>
                                <JobCard
                                    slug={job.slug}
                                    title={job.title}
                                    company={job.company}
                                    jobType={job.jobType}
                                    classLevels={job.classLevels}
                                    location={job.location}
                                    deadline={job.deadline}
                                    logoUrl={job.logoUrl}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
