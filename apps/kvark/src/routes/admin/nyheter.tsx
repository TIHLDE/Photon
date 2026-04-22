import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/nyheter")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello "/admin/nyheter"!</div>;
}
