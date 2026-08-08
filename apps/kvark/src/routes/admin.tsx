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
    Building2Icon,
    CalendarIcon,
    CrownIcon,
    DatabaseIcon,
    DotSquare,
    FileTextIcon,
    FileUserIcon,
    ImagesIcon,
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
    sessionHasPermissionInAnyScope,
} from "#/api/auth";
import { ADMIN_SECTION_PERMISSIONS } from "#/lib/admin-sections";
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
         * Hide this entry unless the session holds one of these permissions,
         * globally or scoped to a group. Cosmetic only — the API is what
         * actually enforces access — but a member who cannot use a section
         * should not be offered it.
         */
        permission?: string | readonly string[];
        /** Also show it to anyone who leads a group. */
        allowGroupLeader?: boolean;
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
                permission: ADMIN_SECTION_PERMISSIONS.arrangementer,
            },
            {
                label: "Nyheter",
                icon: NewspaperIcon,
                link: linkOptions({ to: "/admin/nyheter" }),
                permission: ADMIN_SECTION_PERMISSIONS.nyheter,
            },
            {
                label: "Annonser",
                icon: BriefcaseBusinessIcon,
                link: linkOptions({
                    to: "/admin/annonser",
                }),
                permission: ADMIN_SECTION_PERMISSIONS.annonser,
            },
            {
                label: "Bannere",
                icon: BookmarkIcon,
                link: linkOptions({ to: "/admin/bannere" }),
                permission: ADMIN_SECTION_PERMISSIONS.bannere,
            },
            {
                label: "Galleri",
                icon: ImagesIcon,
                link: linkOptions({ to: "/admin/galleri" }),
                permission: ADMIN_SECTION_PERMISSIONS.galleri,
            },
            {
                label: "TÖDDEL",
                icon: BookOpenIcon,
                link: linkOptions({ to: "/admin/toddel" }),
                permission: ADMIN_SECTION_PERMISSIONS.toddel,
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
                permission: ADMIN_SECTION_PERMISSIONS.brukere,
            },
            {
                // Lederen av en gruppe kommer hit uten noen global groups:*-
                // rettighet — API-et lar lederen redigere sin egen gruppe
                // (`ownership: isGroupLeader`). Sida viser bare gruppene
                // vedkommende faktisk kan røre.
                label: "Grupper",
                icon: Users2Icon,
                link: linkOptions({ to: "/admin/grupper" }),
                permission: ADMIN_SECTION_PERMISSIONS.grupper,
                allowGroupLeader: true,
            },
            {
                label: "Prikker",
                icon: DotSquare,
                link: linkOptions({ to: "/admin/prikker" }),
                permission: ADMIN_SECTION_PERMISSIONS.prikker,
            },
            {
                // Group leaders reach this one without any global roles:*
                // permission — they may create and assign verv inside their
                // own group. The page hides the "Roller"-tab from them.
                label: "Roller og verv",
                icon: CrownIcon,
                link: linkOptions({ to: "/admin/roller" }),
                permission: ADMIN_SECTION_PERMISSIONS.roller,
                allowGroupLeader: true,
            },
            {
                label: "Opptak",
                icon: FileUserIcon,
                link: linkOptions({ to: "/admin/opptak" }),
                permission: ADMIN_SECTION_PERMISSIONS.opptak,
            },
            {
                label: "Søknader",
                icon: FileTextIcon,
                link: linkOptions({ to: "/admin/soknader" }),
                permission: ADMIN_SECTION_PERMISSIONS.soknader,
            },
            {
                label: "Kontaktskjema",
                icon: Building2Icon,
                link: linkOptions({ to: "/admin/kontaktskjema" }),
                permission: ADMIN_SECTION_PERMISSIONS.kontaktskjema,
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
                permission: "root",
            },
            {
                label: "OAuth-klienter",
                icon: ShieldCheckIcon,
                link: linkOptions({ to: "/admin/oauth-clients" }),
                permission: "root",
            },
            {
                label: "Database Viewer",
                icon: DatabaseIcon,
                link: linkOptions({ to: "/admin/database" }),
                permission: "root",
            },
            {
                label: "Logs",
                icon: LogsIcon,
                link: linkOptions({ to: "/admin/logs" }),
                permission: "root",
            },
        ],
    },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { data: session } = useQuery(authQueryOptions);
    const isGroupLeader = Boolean(
        session?.groups?.some((group) => group.role === "leader"),
    );

    // Drop entries the viewer cannot use, then drop groups left empty. A
    // group-scoped grant counts: the section lists more than one group's
    // resources, and the API rejects the ones outside the grant.
    const visibleGroups = sidebarMenuGroups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => {
                if (!item.permission) return true;
                if (item.allowGroupLeader && isGroupLeader) return true;
                return sessionHasPermissionInAnyScope(
                    session?.permissions,
                    item.permission as string | string[],
                );
            }),
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
                            {/* h-6!/w-auto! slår sidebar-knappens [&_svg]:size-4-regel,
                                som ellers ville klemt lockupen til en firkant */}
                            <TihldeLogo
                                variant="full"
                                className="h-6! w-auto! shrink-0"
                            />
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
