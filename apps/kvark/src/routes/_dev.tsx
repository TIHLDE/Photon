import { Outlet, createFileRoute } from "@tanstack/react-router";

// All routes under this layout are development-only and should be removed before publish.
export const Route = createFileRoute("/_dev")({ component: DevLayout });

function DevLayout() {
    return <Outlet />;
}
