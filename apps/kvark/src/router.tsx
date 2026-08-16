import {
    type ErrorComponentProps,
    createRouter as createTanStackRouter,
    useRouter,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import * as TanstackQuery from "#/integrations/tanstack-query";
import { RouteError } from "#/components/route-error";

/**
 * Feilgrensa for alle ruter som ikke har sin egen `errorComponent` — altså
 * alle. Uten den faller de tilbake på TanStack Routers innebygde boks, og ett
 * feilende API-kall i en loader bytter hele sida ut med en engelsk
 * debug-melding. Det traff folk under nettverksbruddet 16. august 2026.
 */
function DefaultRouteError({ error }: ErrorComponentProps) {
    const router = useRouter();

    return (
        <RouteError
            // `invalidate` kjører loaderen på nytt og nullstiller feilgrensa
            // selv, så knappen trenger ikke røre `reset`.
            onRetry={() => void router.invalidate()}
            detail={import.meta.env.DEV ? error.message : undefined}
        />
    );
}

export function getRouter() {
    const queryContext = TanstackQuery.getContext();

    const router = createTanStackRouter({
        routeTree,
        context: { ...queryContext },
        scrollRestoration: true,
        defaultPreload: "intent",
        defaultPreloadStaleTime: 0,
        defaultErrorComponent: DefaultRouteError,
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
