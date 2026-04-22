import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/grupper")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello "/admin/grupper"!</div>;
}
