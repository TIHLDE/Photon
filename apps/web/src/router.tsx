import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { QueryClientProvider } from "@tanstack/react-query";
import { getTheme, ThemeProvider } from "./lib/theme";

export function getRouter() {
  const context = getContext();
  const initialTheme = getTheme();

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    Wrap: ({ children }) => (
      <ThemeProvider initialTheme={initialTheme ?? "light"}>
        <QueryClientProvider client={context.queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    ),
  });

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
