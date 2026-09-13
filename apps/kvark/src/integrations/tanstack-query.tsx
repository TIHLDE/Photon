import {
    isServer,
    MutationCache,
    QueryCache,
    QueryClient,
    QueryClientProvider,
} from "@tanstack/react-query";
import * as React from "react";
import { captureException } from "#/integrations/posthog/capture";

function makeQueryClient() {
    return new QueryClient({
        // Fanger feilende kall som skjer i nettleseren — klientside-
        // navigasjoner, `useQuery` etter hydrering og mutasjoner — som ellers
        // ville blitt spist av en feilgrense og aldri nådd `window.onerror`.
        // Feiler et kall under SSR, rapporteres det i stedet av rutas
        // feilgrense: her kjører vi da på serveren, uten PostHog-klient.
        queryCache: new QueryCache({
            onError: (error, query) =>
                captureException(error, { queryKey: query.queryHash }),
        }),
        mutationCache: new MutationCache({
            onError: (error, _variables, _context, mutation) =>
                captureException(error, {
                    mutationKey: mutation.options.mutationKey?.join("."),
                }),
        }),
        defaultOptions: {
            queries: {
                staleTime: 1000 * 60 * 5, // refetch after 5 minutes
                gcTime: Infinity, // Disable garbage collection
            },
        },
    });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
    if (isServer) {
        // Recreate the query client on the server for each request
        return makeQueryClient();
    } else {
        if (!browserQueryClient) {
            browserQueryClient = makeQueryClient();
        }
        return browserQueryClient;
    }
}

export function getContext() {
    return {
        queryClient: getQueryClient(),
    };
}

export function Provider({
    children,
    queryClient,
}: React.PropsWithChildren<{ queryClient: QueryClient }>) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
