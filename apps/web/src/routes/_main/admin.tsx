import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import {
    Calendar,
    ClipboardList,
    FileText,
    Megaphone,
    Newspaper,
} from "lucide-react";
import { Page } from "~/components/layout/page";
import { getSessionQuery } from "~/lib/queries/auth";

export const Route = createFileRoute("/_main/admin")({
    beforeLoad: async ({ context }) => {
        const session = await context.queryClient.ensureQueryData(
            getSessionQuery(),
        );
        if (!session?.data) {
            throw redirect({ to: "/logg-inn" });
        }
    },
    component: AdminLayout,
});

const NAV_ITEMS = [
    { href: "/admin", label: "Oversikt", icon: ClipboardList },
    { href: "/admin/arrangementer", label: "Arrangementer", icon: Calendar },
    { href: "/admin/nyheter", label: "Nyheter", icon: Newspaper },
    {
        href: "/admin/stillingsannonser",
        label: "Stillingsannonser",
        icon: Megaphone,
    },
    { href: "/admin/skjemaer", label: "Skjemaer", icon: FileText },
];

function AdminLayout() {
    return (
        <Page>
            <div className="flex flex-col gap-6 md:flex-row">
                <nav className="flex gap-1 overflow-x-auto border-b pb-2 md:w-56 md:shrink-0 md:flex-col md:border-b-0 md:border-r md:pb-0 md:pr-6">
                    {NAV_ITEMS.map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <item.icon className="size-4" />
                            {item.label}
                        </a>
                    ))}
                </nav>
                <div className="min-w-0 flex-1">
                    <Outlet />
                </div>
            </div>
        </Page>
    );
}
