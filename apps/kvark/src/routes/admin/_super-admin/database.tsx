import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_super-admin/database")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello "/admin/_super-admin/database"!</div>;
}
