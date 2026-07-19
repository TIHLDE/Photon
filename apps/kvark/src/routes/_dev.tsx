import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dev")({ component: DevLayout });

function DevLayout() {
    return <Outlet />;
}
