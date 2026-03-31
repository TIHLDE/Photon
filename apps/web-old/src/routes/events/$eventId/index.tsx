import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import TIHLDE_LOGO from "~/assets/img/TihldeBackground.jpg";
import Page from "~/components/navigation/Page";
import { getEventQuery } from "~/api/queries/events";

import EventRenderer from "./components/EventRenderer";

export const Route = createFileRoute("/_MainLayout/arrangementer/$id/{-$urlTitle}")({
  loader: async ({ params, context }) => {
    try {
      const event = await context.queryClient.ensureQueryData(getEventQuery(params.id));
      if (!event) {
        throw redirect({ to: "/arrangementer" });
      }
      return { event };
    } catch {
      throw redirect({ to: "/arrangementer" });
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { property: "og:title", content: loaderData?.event?.title },
      { property: "og:type", content: "website" },
      {
        property: "og:url",
        content: typeof window !== "undefined" ? window.location.href : "",
      },
      {
        property: "og:image",
        content: loaderData?.event?.image ?? "https://tihlde.org" + TIHLDE_LOGO,
      },
    ],
  }),
  component: EventDetails,
});

function EventDetails() {
  const { event: initialEvent } = Route.useLoaderData();
  const { data: event } = useSuspenseQuery(getEventQuery(initialEvent.id));

  return (
    <Page>
      <EventRenderer data={event} />
    </Page>
  );
}
