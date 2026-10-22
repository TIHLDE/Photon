import {
    ClientOnly,
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
import { THEME_STORAGE_KEY, ThemeProvider } from "../integrations/theme";
import { CommandMenu } from "#/components/command-menu";

const themeInitScript = `
(function () {
    try {
        var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
        var isDark = stored
            ? stored === "dark"
            : window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (isDark) {
            document.documentElement.classList.add("dark");
        }
    } catch (e) {}
})();
`;

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
                title: "TIHLDE",
            },
            {
                name: "theme-color",
                content: "#16356e",
            },
        ],
        links: [
            {
                rel: "stylesheet",
                href: appCss,
            },
            {
                rel: "icon",
                type: "image/x-icon",
                href: "/favicon.ico",
            },
            {
                rel: "icon",
                type: "image/png",
                sizes: "32x32",
                href: "/browser-icons/favicon-32x32.png",
            },
            {
                rel: "icon",
                type: "image/png",
                sizes: "16x16",
                href: "/browser-icons/favicon-16x16.png",
            },
            {
                rel: "apple-touch-icon",
                sizes: "180x180",
                href: "/browser-icons/apple-icon-180x180.png",
            },
            {
                rel: "manifest",
                href: "/manifest.json",
            },
        ],
    }),
    shellComponent: RootDocument,
});

/**
 * Språket er norsk. Med `lang="en"` slo nettleseren opp all tekst i den
 * engelske ordboka, og da fikk ingen skrivefeil rød strek i skjemaene våre.
 */
function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html lang="nb" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
                <HeadContent />
            </head>
            <body>
                <ThemeProvider>
                    <TooltipProvider>
                        <PostHogProvider>
                            {children}
                            <ClientOnly>
                                <CommandMenu />
                            </ClientOnly>
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
                </ThemeProvider>
                <Scripts />
            </body>
        </html>
    );
}
