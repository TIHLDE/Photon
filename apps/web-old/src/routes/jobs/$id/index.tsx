import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import Page from "~/components/navigation/Page";
import { getJobQuery } from "~/api/queries/jobs";

import JobPostRenderer from "./components/JobPostRenderer";

export const Route = createFileRoute("/_MainLayout/stillingsannonser/$id/{-$urlTitle}")({
  loader: async ({ params, context }) => {
    const jobPost = await context.queryClient.ensureQueryData(getJobQuery(params.id));
    return { jobPost };
  },
  head: ({ loaderData }) => ({
    meta: [
      { property: "og:title", content: loaderData?.jobPost.title },
      { property: "og:type", content: "website" },
      {
        property: "og:url",
        content: typeof window !== "undefined" ? window.location.href : "",
      },
      { property: "og:image", content: loaderData?.jobPost.imageUrl ?? undefined },
    ],
  }),
  component: JobPostDetails,
});

function JobPostDetails() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(getJobQuery(id));

  return (
    <Page>
      <JobPostRenderer data={data} />
    </Page>
  );
}
