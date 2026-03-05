import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { JobPostForm } from "~/components/admin/job-post-form";
import { getJobQuery } from "~/lib/queries/jobs";

export const Route = createFileRoute(
    "/_main/admin/stillingsannonser/$jobPostId",
)({
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getJobQuery(params.jobPostId)),
    component: EditJobPage,
});

function EditJobPage() {
    const { jobPostId } = Route.useParams();
    const { data: job } = useSuspenseQuery(getJobQuery(jobPostId));

    if (!job) return null;

    return (
        <div className="space-y-4">
            <h1 className="font-heading text-2xl font-bold">
                Rediger: {job.title}
            </h1>
            <JobPostForm
                jobId={jobPostId}
                initialData={{
                    title: job.title,
                    ingress: job.ingress,
                    body: job.body,
                    company: job.company,
                    location: job.location,
                    deadline: job.deadline,
                    isContinuouslyHiring: job.isContinuouslyHiring,
                    jobType: job.jobType,
                    email: job.email,
                    link: job.link,
                    classStart: job.classStart,
                    classEnd: job.classEnd,
                    imageUrl: job.imageUrl,
                    imageAlt: job.imageAlt,
                }}
            />
        </div>
    );
}
