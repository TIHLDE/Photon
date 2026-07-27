import {
    createFileRoute,
    Link,
    type LinkOptions,
    linkOptions,
    Outlet,
} from "@tanstack/react-router";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
} from "@tihlde/ui/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import {
    BookmarkIcon,
    BookOpenIcon,
    BriefcaseBusinessIcon,
    CalendarIcon,
    CircleCheckBigIcon,
    CrownIcon,
    DatabaseIcon,
    DotSquare,
    FileTextIcon,
    FileUserIcon,
    KeyIcon,
    LayoutDashboardIcon,
    LogsIcon,
    type LucideIcon,
    NewspaperIcon,
    ShieldCheckIcon,
    UserIcon,
    Users2Icon,
} from "lucide-react";
import * as React from "react";

import {
    authClientWithRedirect,
    authQueryOptions,
    sessionHasPermission,
} from "#/api/auth";
import { AdminLayoutHeader } from "#/components/AdminLayoutHeader";
import { TihldeLogo } from "#/components/icons/tihlde";

export const Route = createFileRoute("/admin")({
    component: AdminLayout,
    async beforeLoad({ location }) {
        // Baseline: you must be signed in to reach the admin shell at all.
        // Each section still relies on the API enforcing its own permission.
        const auth = await authClientWithRedirect(location.href);
        return { auth };
    },
});

function AdminLayout() {
    return (
        <SidebarProvider>
            <AppSidebar variant="sidebar" />
            <SidebarInset className="h-screen overflow-y-auto overscroll-none">
                <AdminLayoutHeader />
                <div className="p-4">
                    <Outlet />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}

type SidebarGroup = {
    id: string;
    label?: string;
    items: {
        label: string;
        link: LinkOptions;

        icon?: LucideIcon;
        /**
         * Hide this entry unless the session holds one of these permissions
         * globally. Omit for sections everyone signed in may reach. Cosmetic
         * only — the API is what actually enforces access.
         */
        permission?: string | string[];
    }[];
};

const sidebarMenuGroups: SidebarGroup[] = [
    {
        id: "main",
        items: [
            //
            {
                label: "Dashboard",
                icon: LayoutDashboardIcon,
                link: linkOptions({
                    to: "/admin",
                    activeOptions: { exact: true },
                }),
            },
        ],
    },
    {
        id: "content",
        label: "Innhold",
        items: [
            {
                label: "Arrangementer",
                icon: CalendarIcon,
                link: linkOptions({ to: "/admin/arrangementer" }),
            },
            {
                label: "Oppmøte",
                icon: CircleCheckBigIcon,
                link: linkOptions({ to: "/admin/oppmote" }),
            },
            {
                label: "Nyheter",
                icon: NewspaperIcon,
                link: linkOptions({ to: "/admin/nyheter" }),
            },
            {
                label: "Annonser",
                icon: BriefcaseBusinessIcon,
                link: linkOptions({
                    to: "/admin/annonser",
                }),
            },
            {
                label: "Bannere",
                icon: BookmarkIcon,
                link: linkOptions({ to: "/admin/bannere" }),
            },
            {
                label: "TÖDDEL",
                icon: BookOpenIcon,
                link: linkOptions({ to: "/admin/toddel" }),
                permission: [
                    "toddel:create",
                    "toddel:update",
                    "toddel:delete",
                    "toddel:manage",
                ],
            },
        ],
    },
    {
        id: "admin",
        label: "Administrasjon",
        items: [
            {
                label: "Brukere",
                icon: UserIcon,
                link: linkOptions({ to: "/admin/brukere" }),
            },
            {
                label: "Grupper",
                icon: Users2Icon,
                link: linkOptions({ to: "/admin/grupper" }),
            },
            {
                label: "Prikker",
                icon: DotSquare,
                link: linkOptions({ to: "/admin/prikker" }),
            },
            {
                label: "Roller og verv",
                icon: CrownIcon,
                link: linkOptions({ to: "/admin/roller" }),
            },
            {
                label: "Opptak",
                icon: FileUserIcon,
                link: linkOptions({ to: "/admin/opptak" }),
            },
            {
                label: "Søknader",
                icon: FileTextIcon,
                link: linkOptions({ to: "/admin/soknader" }),
                permission: [
                    "applications:view",
                    "applications:expense:view",
                    "applications:support:view",
                    "applications:sports-support:view",
                    "applications:hs-case:view",
                    "applications:company-contact:view",
                ],
            },
        ],
    },
    {
        id: "super-admin",
        label: "Super Admin",
        items: [
            {
                label: "API Nøkler",
                icon: KeyIcon,
                link: linkOptions({ to: "/admin/api-keys" }),
            },
            {
                label: "OAuth-klienter",
                icon: ShieldCheckIcon,
                link: linkOptions({ to: "/admin/oauth-clients" }),
            },
            {
                label: "Database Viewer",
                icon: DatabaseIcon,
                link: linkOptions({ to: "/admin/database" }),
            },
            {
                label: "Logs",
                icon: LogsIcon,
                link: linkOptions({ to: "/admin/logs" }),
            },
        ],
    },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { data: session } = useQuery(authQueryOptions);

    // Drop entries the viewer cannot use, then drop groups left empty.
    const visibleGroups = sidebarMenuGroups
        .map((group) => ({
            ...group,
            items: group.items.filter(
                (item) =>
                    !item.permission ||
                    sessionHasPermission(session?.permissions, item.permission),
            ),
        }))
        .filter((group) => group.items.length > 0);

    return (
        <Sidebar collapsible="offcanvas" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem className="h-12">
                        <SidebarMenuButton
                            render={
                                <Link
                                    aria-label="Til forsiden"
                                    to="/"
                                    className="h-full w-full cursor-pointer"
                                    style={{
                                        color: "var(--color-logo, currentColor)",
                                    }}
                                />
                            }
                        >
                            <div className="size-8">
                                <TihldeLogo />
                            </div>
                            <span className="text-sm font-stretch-condensed font-extrabold">
                                TIHLDE
                            </span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                {visibleGroups.map((group) => (
                    <SidebarGroup key={group.id}>
                        {group.label && (
                            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                        )}
                        <SidebarMenu>
                            {group.items.map((item) => (
                                <SidebarMenuItem key={item.label}>
                                    <SidebarMenuButton
                                        render={
                                            <Link
                                                {...item.link}
                                                className="[&.active]:bg-sidebar-primary [&.active]:text-sidebar-primary-foreground"
                                                activeProps={{
                                                    className: "active",
                                                }}
                                            />
                                        }
                                    >
                                        {item.icon && <item.icon />}
                                        <span>{item.label}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroup>
                ))}
            </SidebarContent>
        </Sidebar>
    );
}
