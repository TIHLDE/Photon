import {
    createFileRoute,
    Link,
    type LinkOptions,
    linkOptions,
    Outlet,
} from "@tanstack/react-router";
import {
    DetailLayout,
    DetailLayoutContent,
} from "#/components/detail-layout";
import { Button } from "@tihlde/ui/ui/button";
import { Separator } from "@tihlde/ui/ui/separator";
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
import { Fragment } from "react";
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
        <DetailLayout
            header={
                <ProfileHeader
                    user={USER}
                    actions={
                        <>
                            <MembershipQrDialog name={USER.name} />
                            <EditBioDialog />
                        </>
                    }
                />
            }
        >
            <ProfileNav navGroups={navGroups} />
            <DetailLayoutContent>
                <Outlet />
            </DetailLayoutContent>
        </DetailLayout>
    );
}

function ProfileNav({ navGroups }: { navGroups: ProfileNavGroup[] }) {
    const flatItems = navGroups.flatMap((g) => g.items);

    return (
        <>
            {/* Mobile: horizontal scroll */}
            <nav className="-mx-4 min-w-0 overflow-x-auto px-4 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
                <ul className="flex w-max gap-2">
                    {flatItems.map((item) => (
                        <li key={item.label} className="shrink-0">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="[&.active]:bg-primary [&.active]:text-primary-foreground"
                                render={
                                    <Link
                                        {...item.link}
                                        activeProps={{ className: "active" }}
                                        activeOptions={{
                                            exact: item.exact ?? false,
                                        }}
                                    />
                                }
                            >
                                <item.icon />
                                {item.label}
                            </Button>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Desktop: vertical sidebar */}
            <aside className="hidden md:block">
                <nav className="flex flex-col gap-2">
                    {navGroups.map((group, index) => (
                        <Fragment key={group.id}>
                            {index > 0 ? <Separator className="my-2" /> : null}
                            <ul className="flex flex-col gap-1">
                                {group.items.map((item) => (
                                    <li key={item.label}>
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start [&.active]:bg-primary [&.active]:text-primary-foreground"
                                            render={
                                                <Link
                                                    {...item.link}
                                                    activeProps={{
                                                        className: "active",
                                                    }}
                                                    activeOptions={{
                                                        exact:
                                                            item.exact ?? false,
                                                    }}
                                                />
                                            }
                                        >
                                            <item.icon />
                                            <span className="flex-1 text-left">
                                                {item.label}
                                            </span>
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </Fragment>
                    ))}
                    <Separator className="my-2" />
                    <Button variant="ghost" className="justify-start">
                        <LogOut />
                        Logg ut
                    </Button>
                </nav>
            </aside>
        </>
    );
}
