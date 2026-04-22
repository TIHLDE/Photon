import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_super-admin/api-keys")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello "/admin/_super-admin/api-keys"!</div>;
}
