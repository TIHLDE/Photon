import { createFileRoute, Outlet } from "@tanstack/react-router";

import { authClientWithPermission } from "#/api/auth";

/**
 * Gates the super-admin section (API keys, database, logs, OAuth clients).
 *
 * These tools are root-level: an OAuth client secret or an API key grants
 * standing access to the API, so this requires `root` rather than any
 * per-domain grant.
 */
export const Route = createFileRoute("/admin/_super-admin")({
    component: RouteComponent,
    async beforeLoad({ location }) {
        const auth = await authClientWithPermission(location.href, "root");
        return { auth };
    },
});

function RouteComponent() {
    return <Outlet />;
}
