import type { JobListItem } from "@tihlde/sdk/types";
import { Building2, Clock, MapPin } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { formatDate } from "~/lib/date";

const JOB_TYPE_LABELS: Record<string, string> = {
    full_time: "Fulltid",
    part_time: "Deltid",
    summer_job: "Sommerjobb",
    other: "Annet",
};

type JobPostCardProps = {
    job: JobListItem;
};

export function JobPostCard({ job }: JobPostCardProps) {
    return (
        <a href={`/stillingsannonser/${job.id}`}>
            <Card className="group flex gap-4 p-4 transition-shadow hover:shadow-md">
                {job.imageUrl && (
                    <div className="hidden size-16 shrink-0 overflow-hidden rounded-md sm:block">
                        <img
                            src={job.imageUrl}
                            alt={job.imageAlt ?? job.company}
                            className="size-full object-contain"
                        />
                    </div>
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                            {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                        </Badge>
                        {job.expired && (
                            <Badge
                                variant="outline"
                                className="text-muted-foreground"
                            >
                                Utløpt
                            </Badge>
                        )}
                    </div>
                    <h3 className="font-heading text-base font-semibold leading-tight group-hover:text-primary">
                        {job.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Building2 className="size-3.5" />
                            {job.company}
                        </span>
                        {job.location && (
                            <span className="flex items-center gap-1">
                                <MapPin className="size-3.5" />
                                {job.location}
                            </span>
                        )}
                        {job.deadline && (
                            <span className="flex items-center gap-1">
                                <Clock className="size-3.5" />
                                Frist: {formatDate(job.deadline)}
                            </span>
                        )}
                    </div>
                </div>
            </Card>
        </a>
    );
}
