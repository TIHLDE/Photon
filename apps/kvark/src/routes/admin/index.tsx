import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
    component: RouteComponent,
    loader: () => ({
        breadcrumbs: "Dashboard",
    }),
});

function RouteComponent() {
    return <div>Hello "/admin/"!</div>;
}
