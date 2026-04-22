import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/annonser")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello "/admin/annonser"!</div>;
}
