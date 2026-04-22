import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/arrangementer")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello "/admin/arrangementer"!</div>;
}
