import {
    HeadContent,
    Scripts,
    createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import PostHogProvider from "../integrations/posthog/provider";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import appCss from "../styles.css?url";
import type { QueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@tihlde/ui/ui/tooltip";

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
            {
                title: "TanStack Start Starter",
            },
        ],
        links: [
            {
                rel: "stylesheet",
                href: appCss,
            },
        ],
    }),
    shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <HeadContent />
            </head>
            <body>
                <TooltipProvider>
                    <PostHogProvider>
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
                                {
                                    name: "Tanstack Query",
                                    render: <ReactQueryDevtoolsPanel />,
                                },
                            ]}
                        />
                    </PostHogProvider>
                </TooltipProvider>
                <Scripts />
            </body>
        </html>
    );
}
