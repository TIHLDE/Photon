import { createFileRoute } from "@tanstack/react-router";
import { JobPostForm } from "~/components/admin/job-post-form";

export const Route = createFileRoute("/_main/admin/stillingsannonser/ny")({
    component: CreateJobPage,
});

function CreateJobPage() {
    return (
        <div className="space-y-4">
            <h1 className="font-heading text-2xl font-bold">
                Ny stillingsannonse
            </h1>
            <JobPostForm />
        </div>
    );
}
