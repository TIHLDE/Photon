import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_super-admin")({
    component: RouteComponent,
    beforeLoad() {
        // TODO: Do even stricter admin checks
    },
});

function RouteComponent() {
    return <Outlet />;
}
