import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/opptak")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello "/admin/opptak"!</div>;
}
