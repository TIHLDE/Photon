import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/profil/$id/prikker")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Prikker</div>;
}
