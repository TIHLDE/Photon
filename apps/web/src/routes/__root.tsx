/// <reference types="vite/client" />
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
    HeadContent,
    Outlet,
    Scripts,
    createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type * as React from "react";
import TanStackQueryDevtools from "~/integrations/tanstack-query/devtools";
import TanStackQueryProvider from "~/integrations/tanstack-query/root-provider";
import appCss from "~/styles/app.css?url";

interface MyRouterContext {
    queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
    head: () => ({
        meta: [
            {
                charSet: "utf-8",
            },
            {
                name: "viewport",
                content: "width=device-width, initial-scale=1",
            },
        ],
        links: [
            { rel: "stylesheet", href: appCss },
            { rel: "icon", href: "/favicon.ico" },
        ],
    }),
    component: RootComponent,
    shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html lang="no">
            <head>
                <HeadContent />
            </head>
            <body>
                <TanStackQueryProvider>
                    {children}
                    <TanStackDevtools
                        config={{
                            position: "bottom-right",
                        }}
                        plugins={[
                            {
                                name: "Tanstack Router",
                                render: <TanStackRouterDevtoolsPanel />,
                            },
                            TanStackQueryDevtools,
                        ]}
                    />
                </TanStackQueryProvider>
                <Scripts />
            </body>
        </html>
    );
}

function RootComponent() {
    return <Outlet />;
}
