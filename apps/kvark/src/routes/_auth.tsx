import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { authQueryOptions } from "#/api/auth";
import { TihldeLogo } from "#/components/icons/tihlde";
import { SiteBottomBar } from "#/components/site-bottom-bar";
import { useSiteNavItems } from "#/components/site-nav-items";

export const Route = createFileRoute("/_auth")({ component: AuthLayout });

function AuthLayout() {
    const { data: session } = useQuery(authQueryOptions);
    const isAuthenticated = Boolean(session?.user);
    const navItems = useSiteNavItems(isAuthenticated);

    return (
        // These pages have no header, so on mobile the bottom bar is the only
        // way out of them — hence the padding that keeps it off the form.
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12 pb-28 md:pb-12">
            <Link
                to="/"
                className="flex items-center gap-1"
                style={{ color: "var(--color-logo, currentColor)" }}
            >
                <div className="size-14">
                    <TihldeLogo />
                </div>
                <span className="text-3xl font-stretch-condensed font-extrabold">
                    TIHLDE
                </span>
            </Link>
            <div className="w-full max-w-md">
                <Outlet />
            </div>
            <SiteBottomBar
                navItems={navItems}
                isAuthenticated={isAuthenticated}
            />
        </div>
    );
}
