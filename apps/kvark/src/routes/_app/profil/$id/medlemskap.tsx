import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/profil/$id/medlemskap")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Medlemskap</div>;
}
