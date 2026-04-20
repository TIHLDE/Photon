import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import { QueryClientProvider } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getContext } from "./integrations/tanstack-query/client";

export function getRouter() {
    const context = getContext();

    const router = createTanStackRouter({
        routeTree,
        context,
        scrollRestoration: true,
        defaultPreload: "intent",
        defaultPreloadStaleTime: 0,
        Wrap({ children }) {
            return (
                <QueryClientProvider client={context.queryClient}>
                    {children}
                </QueryClientProvider>
            );
        },
    });

    setupRouterSsrQueryIntegration({
        router,
        queryClient: context.queryClient,
    });

    return router;
}

declare module "@tanstack/react-router" {
    interface Register {
        router: ReturnType<typeof getRouter>;
    }
}
