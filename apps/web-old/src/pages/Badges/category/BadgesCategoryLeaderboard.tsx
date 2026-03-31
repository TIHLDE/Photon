import { createFileRoute } from "@tanstack/react-router";
import { authClientWithRedirect } from "~/api/auth";
import BadgesLeaderboard from "~/pages/Badges/BadgesLeaderboard";

export const Route = createFileRoute("/_MainLayout/badges/kategorier/$categoryId/")({
  async beforeLoad({ location, context }) {
    await authClientWithRedirect({
      url: location.href,
      queryClient: context.queryClient,
    });
  },
  component: BadgesCategoryLeaderboard,
});

function BadgesCategoryLeaderboard() {
  const { categoryId } = Route.useParams();
  return <BadgesLeaderboard filters={{ category: categoryId }} />;
}
