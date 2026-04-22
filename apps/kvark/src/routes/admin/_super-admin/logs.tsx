import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_super-admin/logs")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello "/admin/_super-admin/logs"!</div>;
}
