import { Link } from "@tanstack/react-router";
import { JobListEntry } from "~/api/queries";
import AspectRatioImg from "~/components/miscellaneous/AspectRatioImg";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { formatDate, urlEncode } from "~/utils";
import { CalendarClock, MapPin } from "lucide-react";

const jobTypeLabel: Record<string, string> = {
  full_time: "Fulltid",
  part_time: "Deltid",
  summer_job: "Sommerjobb",
  other: "Annet",
};

const classLabel: Record<string, string> = {
  first: "1.",
  second: "2.",
  third: "3.",
  fourth: "4.",
  fifth: "5.",
  alumni: "Alumni",
};

export type JobPostListItemProps = {
  jobPost: JobListEntry;
};

const JobPostListItem = ({ jobPost }: JobPostListItemProps) => {
  const deadline = jobPost.isContinuouslyHiring ? "Fortløpende" : jobPost.deadline ? formatDate(jobPost.deadline, { time: false }) : "-";

  const classRange =
    jobPost.classStart === jobPost.classEnd
      ? `${classLabel[jobPost.classStart] ?? jobPost.classStart} klasse`
      : `${classLabel[jobPost.classStart] ?? jobPost.classStart} - ${classLabel[jobPost.classEnd] ?? jobPost.classEnd} klasse`;

  return (
    <Link
      className="block bg-muted rounded-lg"
      to="/stillingsannonser/$id/{-$urlTitle}"
      params={{ id: jobPost.id.toString(), urlTitle: urlEncode(jobPost.title) }}
    >
      <div className="group rounded-lg overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 bg-muted/30">
        {/* Responsive layout - vertical on mobile, horizontal on sm and up */}
        <div className="flex flex-col xl:flex-row h-full">
          {/* Card Image */}
          <div className="w-full xl:w-3/6">
            <AspectRatioImg alt={jobPost.imageAlt || jobPost.title} className="w-full object-cover!" ratio={"16:7"} src={jobPost.imageUrl ?? undefined} />
          </div>

          {/* Card Content */}
          <div className="flex-1 p-4 flex flex-col justify-between">
            {/* Title and Badges */}
            <div className="space-y-3">
              <h2 className="text-xl font-bold line-clamp-2 group-hover:text-primary transition-colors">{jobPost.title}</h2>

              <div className="flex flex-wrap gap-2">
                <Badge className="bg-primary test-primary-foreground font-medium px-3 py-1 rounded-full w-fit">
                  {jobTypeLabel[jobPost.jobType] ?? jobPost.jobType}
                </Badge>
                <Badge className="bg-primary test-primary-foreground font-medium px-3 py-1 rounded-full w-fit">{jobPost.company}</Badge>
                <Badge className="bg-primary test-primary-foreground font-medium px-3 py-1 rounded-full w-fit">{classRange}</Badge>
              </div>
            </div>

            {/* Location and Deadline */}
            <div className="mt-4 gap-2 md:space-y-2 space-x-2  flex md:flex-col md:space-x-0 ">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <span>{jobPost.location}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
                <span>{deadline}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default JobPostListItem;

export function JobPostListItemLoading({ length = 3 }: { length?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: length }).map((_, index) => (
        <div className="rounded-lg overflow-hidden shadow-xs flex flex-col sm:flex-row h-full bg-muted/30" key={index}>
          {/* Skeleton Image */}
          <div className="w-full sm:w-2/5">
            <Skeleton className="w-full h-[120px]" />
          </div>

          {/* Skeleton Content */}
          <div className="flex-1 p-4 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Title */}
              <Skeleton className="h-7 w-3/4" />

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            </div>

            {/* Location and Deadline */}
            <div className="mt-4 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
