import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { authQueryOptions } from "#/api/auth";
import { SiteBottomBar } from "#/components/site-bottom-bar";
import { SiteFooter } from "#/components/site-footer";
import { SiteHeader } from "#/components/site-header";
import { useSiteNavItems } from "#/components/site-nav-items";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
    const { data: session } = useQuery(authQueryOptions);

    const currentUser = session?.user
        ? {
              name: session.user.name,
              avatarUrl:
                  session.user.settings?.imageUrl ??
                  session.user.image ??
                  undefined,
          }
        : null;
    const isAuthenticated = Boolean(currentUser);
    const navItems = useSiteNavItems(isAuthenticated);

    return (
        // The bottom padding keeps the footer clear of the fixed bottom bar,
        // which only exists below md.
        <div className="flex min-h-screen flex-col pb-16 md:pb-0">
            <SiteHeader navItems={navItems} user={currentUser} />
            <main className="flex flex-1 flex-col">
                <Outlet />
            </main>
            <SiteFooter />
            <SiteBottomBar
                navItems={navItems}
                isAuthenticated={isAuthenticated}
            />
        </div>
    );
}
