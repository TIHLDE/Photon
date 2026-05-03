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
    SidebarFooter,
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarInset,
    SidebarProvider,
} from "@tihlde/ui/ui/sidebar";
import { Button } from "@tihlde/ui/ui/button";
import {
    CalendarDays,
    HelpCircle,
    LayoutGrid,
    LogOut,
    ShieldCheck,
    Ticket,
    UserCircle2,
    type LucideIcon,
} from "lucide-react";
import { EditBioDialog } from "#/components/edit-bio-dialog";
import { MembershipQrDialog } from "#/components/membership-qr-dialog";
import { ProfileHeader } from "#/components/profile-header";
import { USER } from "#/mock/profile";

export const Route = createFileRoute("/_app/profil/$id")({
    component: RouteComponent,
});

type ProfileNavGroup = {
    id: string;
    items: {
        label: string;
        icon: LucideIcon;
        link: LinkOptions;
        exact?: boolean;
    }[];
};

function RouteComponent() {
    const { id } = Route.useParams();

    const navGroups: ProfileNavGroup[] = [
        {
            id: "main",
            items: [
                {
                    label: "Oversikt",
                    icon: LayoutGrid,
                    link: linkOptions({ to: "/profil/$id", params: { id } }),
                    exact: true,
                },
                {
                    label: "Arrangementer",
                    icon: CalendarDays,
                    link: linkOptions({
                        to: "/profil/$id/arrangementer",
                        params: { id },
                    }),
                },
                {
                    label: "Medlemskap",
                    icon: UserCircle2,
                    link: linkOptions({
                        to: "/profil/$id/medlemskap",
                        params: { id },
                    }),
                },
                {
                    label: "Prikker",
                    icon: Ticket,
                    link: linkOptions({
                        to: "/profil/$id/prikker",
                        params: { id },
                    }),
                },
                {
                    label: "Spørreskjemaer",
                    icon: HelpCircle,
                    link: linkOptions({
                        to: "/profil/$id/sporreskjemaer",
                        params: { id },
                    }),
                },
            ],
        },
        {
            id: "secondary",
            items: [
                {
                    label: "Admin",
                    icon: ShieldCheck,
                    link: linkOptions({ to: "/admin" }),
                },
            ],
        },
    ];

    return (
        <SidebarProvider>
            <ProfileSidebar navGroups={navGroups} />
            <SidebarInset>
                <div className="p-6">
                    <ProfileHeader
                        user={USER}
                        actions={
                            <>
                                <MembershipQrDialog name={USER.name} />
                                <EditBioDialog />
                            </>
                        }
                    />
                </div>
                <div className="flex flex-col gap-6 px-6 pb-6">
                    <Outlet />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}

function ProfileSidebar({ navGroups }: { navGroups: ProfileNavGroup[] }) {
    return (
        <Sidebar>
            <SidebarContent>
                {navGroups.map((group) => (
                    <SidebarGroup key={group.id}>
                        <SidebarMenu>
                            {group.items.map((item) => (
                                <SidebarMenuItem key={item.label}>
                                    <SidebarMenuButton
                                        render={
                                            <Link
                                                {...item.link}
                                                activeProps={{
                                                    className: "active",
                                                }}
                                                activeOptions={{
                                                    exact: item.exact ?? false,
                                                }}
                                                className="[&.active]:bg-sidebar-primary [&.active]:text-sidebar-primary-foreground"
                                            />
                                        }
                                    >
                                        <item.icon />
                                        <span>{item.label}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroup>
                ))}
            </SidebarContent>
            <SidebarFooter>
                <Button variant="ghost" className="w-full justify-start">
                    <LogOut />
                    Logg ut
                </Button>
            </SidebarFooter>
        </Sidebar>
    );
}
