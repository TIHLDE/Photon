import {
    createFileRoute,
    Link,
    type LinkOptions,
    linkOptions,
    Outlet,
    useMatchRoute,
    useNavigate,
} from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
    authClientWithRedirect,
    authQueryOptions,
    invalidateAuth,
    logoutUser,
} from "#/api/auth";
import { updateUserSettingsMutation } from "#/api/queries/user";
import { EditBioDialog } from "#/components/edit-bio-dialog";
import { MembershipQrDialog } from "#/components/membership-qr-dialog";
import {
    ProfileHeader,
    type ProfileHeaderUser,
    type ProfileLink,
} from "#/components/profile-header";

export const Route = createFileRoute("/_app/profil/$id")({
    component: RouteComponent,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
});

type ProfileNavItem = {
    label: string;
    icon: LucideIcon;
    link: LinkOptions;
    exact?: boolean;
};

type ProfileNavGroup = {
    id: string;
    items: ProfileNavItem[];
};

function buildProfileLinks(
    githubUrl?: string | null,
    linkedinUrl?: string | null,
): ProfileLink[] {
    const links: ProfileLink[] = [];
    if (githubUrl) links.push({ kind: "github", label: "github" });
    if (linkedinUrl) links.push({ kind: "linkedin", label: "linkedin" });
    return links;
}

function RouteComponent() {
    const { id } = Route.useParams();
    const navigate = useNavigate();

    const { data: session } = useQuery(authQueryOptions);
    const updateSettings = useMutation(updateUserSettingsMutation);

    const settings = session?.user.settings;
    const user: ProfileHeaderUser = {
        name: session?.user.name ?? "",
        email: session?.user.email ?? "",
        avatarUrl: settings?.imageUrl ?? session?.user.image ?? undefined,
        links: buildProfileLinks(settings?.githubUrl, settings?.linkedinUrl),
    };

    async function handleLogout() {
        await logoutUser();
        await navigate({ to: "/" });
    }

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
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <ProfileHeader
                user={user}
                actions={
                    <>
                        <MembershipQrDialog name={user.name} />
                        <EditBioDialog
                            defaultValues={{
                                bio: settings?.bioDescription ?? "",
                                github: settings?.githubUrl ?? "",
                                linkedin: settings?.linkedinUrl ?? "",
                            }}
                            onSubmit={async (values) => {
                                await updateSettings.mutateAsync({
                                    data: {
                                        bioDescription: values.bio || undefined,
                                        githubUrl: values.github || undefined,
                                        linkedinUrl:
                                            values.linkedin || undefined,
                                        allergies: settings?.allergies ?? [],
                                    },
                                });
                                await invalidateAuth();
                            }}
                        />
                    </>
                }
            />
            <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
                <ProfileNav navGroups={navGroups} onLogout={handleLogout} />
                <section className="flex min-w-0 flex-col gap-6">
                    <Outlet />
                </section>
            </div>
        </div>
    );
}

function NavButton({
    item,
    size,
    className,
}: {
    item: ProfileNavItem;
    size?: "default" | "sm";
    className?: string;
}) {
    const matchRoute = useMatchRoute();
    const isActive = !!matchRoute({
        to: item.link.to as string,
        params: item.link.params as Record<string, string> | undefined,
        fuzzy: !(item.exact ?? false),
    });

    return (
        <Button
            variant={isActive ? "default" : "ghost"}
            size={size}
            className={className}
            render={<Link {...item.link} />}
        >
            <item.icon />
            <span>{item.label}</span>
        </Button>
    );
}

function ProfileNav({
    navGroups,
    onLogout,
}: {
    navGroups: ProfileNavGroup[];
    onLogout: () => void;
}) {
    const flatItems = navGroups.flatMap((g) => g.items);

    return (
        <>
            {/* Mobile: horizontal scroll */}
            <nav className="-mx-4 min-w-0 overflow-x-auto px-4 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
                <ul className="flex w-max gap-2">
                    {flatItems.map((item) => (
                        <li key={item.label} className="shrink-0">
                            <NavButton item={item} size="sm" />
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
                                        <NavButton
                                            item={item}
                                            className="w-full justify-start"
                                        />
                                    </li>
                                ))}
                            </ul>
                        </Fragment>
                    ))}
                    <Separator className="my-2" />
                    <Button
                        variant="ghost"
                        className="justify-start"
                        onClick={onLogout}
                    >
                        <LogOut />
                        Logg ut
                    </Button>
                </nav>
            </aside>
        </>
    );
}
