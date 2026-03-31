import { Link } from "@tanstack/react-router";
import AspectRatioImg from "~/components/miscellaneous/AspectRatioImg";
import DetailContent from "~/components/miscellaneous/DetailContent";
import MarkdownRenderer from "~/components/miscellaneous/MarkdownRenderer";
import ShareButton from "~/components/miscellaneous/ShareButton";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useAnalytics } from "~/hooks/Utils";
import type { JobDetail } from "~/api/queries/jobs";
import { formatDate } from "~/utils";
import { parseISO } from "date-fns";
import { PencilIcon } from "lucide-react";

export type JobPostRendererProps = {
  data: JobDetail;
  preview?: boolean;
};

const JOB_TYPE_LABELS: Record<JobDetail["jobType"], string> = {
  full_time: "Fulltid",
  part_time: "Deltid",
  summer_job: "Sommerjobb",
  other: "Annet",
};

const CLASS_LABELS: Record<JobDetail["classStart"], string> = {
  first: "1",
  second: "2",
  third: "3",
  fourth: "4",
  fifth: "5",
  alumni: "Alumni",
};

const JobPostRenderer = ({ data, preview = false }: JobPostRendererProps) => {
  const { event } = useAnalytics();
  const deadline = data.deadline ? formatDate(parseISO(data.deadline)) : null;
  const publishedAt = formatDate(parseISO(data.createdAt));

  const goToApplyLink = () => event("apply", "jobposts", `Apply to: ${data.company}, ${data.title}`);

  const classRange =
    data.classStart === data.classEnd ? CLASS_LABELS[data.classStart] + "." : CLASS_LABELS[data.classStart] + ". - " + CLASS_LABELS[data.classEnd] + ".";

  return (
    <div className="grid lg:grid-cols-[3fr_1fr] gap-4 items-start">
      <div className="space-y-4">
        <AspectRatioImg alt={data.imageAlt || data.title} className="rounded-md" src={data.imageUrl ?? undefined} />

        <Card>
          <CardHeader>
            <CardTitle>{data.title}</CardTitle>
            <CardDescription>Publisert: {publishedAt}</CardDescription>
          </CardHeader>
          <CardContent>
            <MarkdownRenderer value={data.ingress || ""} />
            <MarkdownRenderer value={data.body} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <DetailContent info={data.company} title="Bedrift: " />
            <DetailContent info={data.isContinuouslyHiring ? "Fortl\u00F8pende opptak" : (deadline ?? "")} title="S\u00F8knadsfrist: " />
            <DetailContent info={classRange} title="\u00C5rstrinn: " />
            <DetailContent info={JOB_TYPE_LABELS[data.jobType]} title="Stillingstype: " />
            <DetailContent info={data.location} title="Sted: " />
          </CardContent>
        </Card>

        <div className="space-y-2">
          {data.email && (
            <DetailContent
              info={
                <a href={`mailto:${data.email}`} rel="noreferrer" target="_blank">
                  {data.email}
                </a>
              }
              title="Kontakt: "
            />
          )}
          {data.link && (
            <Button asChild className="w-full">
              <a href={data.link} onClick={goToApplyLink} rel="noreferrer" target="_blank">
                S\u00F8k
              </a>
            </Button>
          )}
          <ShareButton shareId={data.id} shareType="jobpost" title={data.title} />
          {!preview && (
            <Button asChild className="w-full text-black dark:text-white" variant="outline">
              <Link to="/admin/stillingsannonser/{-$jobPostId}" params={{ jobPostId: data.id.toString() }}>
                <PencilIcon className="mr-2 w-5 h-5 stroke-[1.5px]" />
                Endre annonse
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobPostRenderer;

export const JobPostRendererLoading = () => {
  return (
    <div className="grid lg:grid-cols-[3fr_1fr] items-start gap-4">
      <div className="space-y-4">
        <Skeleton className="h-96" />
        <Skeleton className="h-60" />
      </div>

      <div>
        <Skeleton className="h-60" />
      </div>
    </div>
  );
};
