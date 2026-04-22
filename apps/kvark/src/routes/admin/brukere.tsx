import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/brukere")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello "/admin/brukere"!</div>;
}
