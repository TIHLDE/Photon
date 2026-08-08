import { createFileRoute } from "@tanstack/react-router";

import { authClientWithRedirect } from "#/api/auth";

export const Route = createFileRoute("/_app/galleri")({
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
});
