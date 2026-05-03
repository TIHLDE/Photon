import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/profil/$id/sporreskjemaer")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Spørreskjemaer</div>;
}
