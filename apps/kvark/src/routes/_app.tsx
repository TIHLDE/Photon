import { Outlet, createFileRoute, linkOptions } from "@tanstack/react-router";

import { SiteFooter } from "#/components/site-footer";
import { SiteHeader, type NavItem } from "#/components/site-header";
import { useTheme } from "#/integrations/theme";

export const Route = createFileRoute("/_app")({ component: AppLayout });

const NAV_ITEMS: NavItem[] = [
    {
        kind: "group",
        label: "Generelt",
        items: [
            {
                kind: "internal",
                label: "Nyheter",
                link: linkOptions({ to: "/nyheter" }),
                description: "Se de siste nyhetene fra TIHLDE",
            },
            {
                kind: "internal",
                label: "TÖDDEL",
                link: linkOptions({ to: "/toddel" }),
                description: "TIHLDE sitt eget studentblad",
            },
            {
                kind: "internal",
                label: "Gruppeoversikt",
                link: linkOptions({ to: "/grupper" }),
                description: "Få oversikt over alle verv og grupper",
            },
            {
                kind: "internal",
                label: "Interessegrupper",
                link: linkOptions({ to: "/" }),
                description: "Se alle interessegrupper",
            },
            {
                kind: "internal",
                label: "Fondet",
                link: linkOptions({ to: "/" }),
                description: "Se hvordan det ligger an med fondet vårt",
            },
        ],
    },
    {
        kind: "external",
        label: "Ny student",
        href: "#",
    },
    {
        kind: "internal",
        label: "Arrangementer",
        link: linkOptions({ to: "/arrangementer" }),
    },
    { kind: "internal", label: "Wiki", link: linkOptions({ to: "/" }) },
    {
        kind: "internal",
        label: "Stillinger",
        link: linkOptions({ to: "/annonser" }),
    },
    {
        kind: "external",
        label: "For Bedrifter",
        href: "https://bedrift.tihlde.org",
    },
];

function AppLayout() {
    const { theme, mounted, toggleTheme } = useTheme();
    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader
                navItems={NAV_ITEMS}
                user={{ name: "A" }}
                theme={theme}
                themeReady={mounted}
                onToggleTheme={toggleTheme}
            />
            <main className="flex flex-1 flex-col">
                <Outlet />
            </main>
            <SiteFooter />
        </div>
    );
}
