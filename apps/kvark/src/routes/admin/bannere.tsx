import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/bannere")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello "/admin/bannere"!</div>;
}
