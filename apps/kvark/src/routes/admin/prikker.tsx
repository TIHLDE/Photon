import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/prikker")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello "/admin/prikker"!</div>;
}
