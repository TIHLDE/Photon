import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import * as TanstackQuery from "#/integrations/tanstack-query";

export function getRouter() {
    const queryContext = TanstackQuery.getContext();

    const router = createTanStackRouter({
        routeTree,
        context: { ...queryContext },
        scrollRestoration: true,
        defaultPreload: "intent",
        defaultPreloadStaleTime: 0,
        Wrap({ children }) {
            return (
                <TanstackQuery.Provider {...queryContext}>
                    {children}
                </TanstackQuery.Provider>
            );
        },
    });

    setupRouterSsrQueryIntegration({
        router,
        queryClient: queryContext.queryClient,
    });

    return router;
}

declare module "@tanstack/react-router" {
    interface Register {
        router: ReturnType<typeof getRouter>;
    }
}
