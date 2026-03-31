import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import TIHLDE_LOGO from "~/assets/img/TihldeBackground.jpg";
import Page from "~/components/navigation/Page";
import { getNewsQuery } from "~/api/queries/news";

import NewsRenderer from "./components/NewsRenderer";

export const Route = createFileRoute("/_MainLayout/nyheter/$id/{-$urlTitle}")({
  loader: async ({ params, context }) => {
    const news = await context.queryClient.ensureQueryData(getNewsQuery(params.id));
    return { news };
  },
  head: ({ loaderData }) => ({
    meta: [
      { property: "og:title", content: loaderData?.news.title },
      { property: "og:type", content: "website" },
      {
        property: "og:url",
        content: typeof window !== "undefined" ? window.location.href : "",
      },
      {
        property: "og:image",
        content: loaderData?.news.imageUrl || "https://tihlde.org" + TIHLDE_LOGO,
      },
    ],
  }),
  component: NewsDetails,
});

function NewsDetails() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(getNewsQuery(id));

  return (
    <Page>
      <div className="pb-4">
        <NewsRenderer data={data} />
      </div>
    </Page>
  );
}
