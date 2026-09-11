import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Groups the super-admin tools (API keys, database, logs, OAuth clients).
 *
 * Deliberately ungated: each page requires exactly what its own endpoints
 * require, so a grant handed out in Tilganger opens the page it names.
 * Database and Logs stay on `root` because nothing in the panel grants them.
 */
export const Route = createFileRoute("/admin/_super-admin")({
    component: RouteComponent,
});

function RouteComponent() {
    return <Outlet />;
}
