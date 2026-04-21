import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { JobCard, type JobCardProps } from "#/components/job-card";
import {
    JobFilters,
    type JobFiltersValue,
    type JobType,
} from "#/components/job-filters";

export const Route = createFileRoute("/_app/annonser")({ component: JobsPage });

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

const JOBS: JobCardProps[] = [
    {
        title: "Fullstack Utvikler – Sommerjobb",
        company: "Fikse",
        jobType: "Sommerjobb",
        classLevels: "3. - 5. klasse",
        location: "Oslo",
        deadline: "Fortløpende",
    },
    {
        title: "Hjelp ungdommer med matteleksjer på nett – Matteheiten",
        company: "Matteheiten",
        jobType: "Deltid",
        classLevels: "Digitalt",
        location: "Nett",
        deadline: "Man 15. juni",
    },
    {
        title: "Social Minds",
        company: "Social Minds",
        jobType: "Deltid",
        classLevels: "1. - 5. klasse",
        location: "Digitalt",
        deadline: "Fortløpende",
    },
    {
        title: "Cloud Engineer",
        company: "Borg",
        jobType: "Deltid",
        classLevels: "1. - 5. klasse",
        location: "Trondheim",
        deadline: "Fortløpende",
    },
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
                            <li key={job.title}>
                                <JobCard {...job} />
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
