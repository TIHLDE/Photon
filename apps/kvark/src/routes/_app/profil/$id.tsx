import {
    createFileRoute,
    Link,
    type LinkOptions,
    linkOptions,
    Outlet,
    redirect,
    useMatchRoute,
    useNavigate,
} from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import { ScrollFade } from "@tihlde/ui/ui/scroll-fade";
import { Separator } from "@tihlde/ui/ui/separator";
import {
    CalendarDays,
    HelpCircle,
    LayoutGrid,
    LogOut,
    Pencil,
    Settings,
    ShieldCheck,
    Ticket,
    UserCircle2,
    type LucideIcon,
} from "lucide-react";
import { Fragment, useState } from "react";
import {
    authClientWithRedirect,
    authQueryOptions,
    invalidateAuth,
    logoutUser,
    OWN_PROFILE_ALIAS,
} from "#/api/auth";
import {
    getUserProfileQuery,
    updateUserSettingsMutation,
} from "#/api/queries/user";
import { useIsAdmin } from "#/hooks/use-permission";
import { EditBioDialog } from "#/components/edit-bio-dialog";
import { MembershipQrDialog } from "#/components/membership-qr-dialog";
import {
    ProfileHeader,
    type ProfileHeaderUser,
    type ProfileLink,
} from "#/components/profile-header";
import { formatStudyLabel } from "#/lib/utils";

export const Route = createFileRoute("/_app/profil/$id")({
    component: RouteComponent,
    beforeLoad: async ({ location, params }) => {
        const auth = await authClientWithRedirect(location.href);
        // Menyene lenker til /profil/me som en snarvei til «min profil».
        // Bytt aliaset med den lesbare varianten når kontoen har en.
        if (params.id === OWN_PROFILE_ALIAS) {
            throw redirect({
                to: "/profil/$id",
                params: { id: auth.user.username ?? auth.user.id },
                replace: true,
            });
        }
        return auth;
    },
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getUserProfileQuery(params.id)),
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
    if (githubUrl)
        links.push({ kind: "github", label: "GitHub", url: githubUrl });
    if (linkedinUrl)
        links.push({ kind: "linkedin", label: "LinkedIn", url: linkedinUrl });
    return links;
}

function RouteComponent() {
    const { id } = Route.useParams();
    const navigate = useNavigate();

    // Everything on screen comes from the profile endpoint, so the page renders
    // the same whoever is being looked at. The session only decides whether the
    // viewer gets the edit affordances.
    const { data: profile } = useSuspenseQuery(getUserProfileQuery(id));
    const { data: session } = useQuery(authQueryOptions);
    const isOwnProfile = session?.user.id === profile.id;
    // Fanene under henter medlemsdata og svarer 403 for en bruker som venter
    // på godkjenning. De skjules, slik at profilsiden — og «Logg ut» — funker.
    const isPendingApproval = session?.user?.isPendingApproval === true;
    const isAdmin = useIsAdmin();
    const updateSettings = useMutation(updateUserSettingsMutation);
    const [bioOpen, setBioOpen] = useState(false);

    const settings = session?.user.settings;
    // Fra API-et, ikke utledet her: hvilket studie som er det gjeldende, og
    // hvilket klassetrinn det gir, er regler serveren allerede eier.
    const studyLabel = formatStudyLabel({
        programme: profile.studyProgram,
        classYear: profile.classYear,
        startYear: profile.studyStartYear,
    });
    const user: ProfileHeaderUser = {
        name: profile.name,
        // E-post er ikke en del av den offentlige profilen. Din egen ligger i
        // sesjonen; på en annens profil sender API-et den bare til en admin med
        // `users:view`, og null til alle andre.
        email: isOwnProfile
            ? (session?.user.email ?? undefined)
            : (profile.email ?? undefined),
        avatarUrl: profile.image ?? undefined,
        programme: studyLabel,
        links: buildProfileLinks(profile.githubUrl, profile.linkedinUrl),
    };

    async function handleLogout() {
        await logoutUser();
        await navigate({ to: "/" });
    }

    // Prikker, spørreskjemaer og admin er den innloggede brukerens egne ting og
    // gir ingen mening på en annens profil.
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
                ...(isOwnProfile && !isPendingApproval
                    ? [
                          {
                              label: "Arrangementer",
                              icon: CalendarDays,
                              link: linkOptions({
                                  to: "/profil/$id/arrangementer",
                                  params: { id },
                              }),
                          },
                      ]
                    : []),
                {
                    label: "Medlemskap",
                    icon: UserCircle2,
                    link: linkOptions({
                        to: "/profil/$id/medlemskap",
                        params: { id },
                    }),
                },
                ...(isOwnProfile && !isPendingApproval
                    ? [
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
                      ]
                    : []),
                ...(isOwnProfile
                    ? [
                          {
                              label: "Innstillinger",
                              icon: Settings,
                              link: linkOptions({
                                  to: "/profil/$id/innstillinger",
                                  params: { id },
                              }),
                          },
                      ]
                    : []),
            ],
        },
        // Admin entry point — only for admins. The API still enforces access.
        ...(isOwnProfile && isAdmin
            ? [
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
              ]
            : []),
    ];

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <ProfileHeader
                user={user}
                actions={
                    isOwnProfile ? (
                        <>
                            <MembershipQrDialog
                                name={user.name}
                                userId={session?.user.id}
                            />
                            <Button onClick={() => setBioOpen(true)}>
                                <Pencil />
                                Rediger bio
                            </Button>
                        </>
                    ) : null
                }
            />
            {/* Dialogen styres herfra slik at «Rediger bio» i headeren kan
                åpne den. */}
            {isOwnProfile ? (
                <EditBioDialog
                    open={bioOpen}
                    onOpenChange={setBioOpen}
                    defaultValues={{
                        bio: settings?.bioDescription ?? "",
                        github: settings?.githubUrl ?? "",
                        linkedin: settings?.linkedinUrl ?? "",
                    }}
                    onSubmit={async (values) => {
                        await updateSettings.mutateAsync({
                            data: {
                                // Tomme strenger må sendes med — `undefined`
                                // betyr «ikke endre», så feltene kunne aldri
                                // tømmes igjen. API-et lagrer tomt som NULL.
                                bioDescription: values.bio,
                                githubUrl: values.github,
                                linkedinUrl: values.linkedin,
                                allergies: settings?.allergies ?? [],
                            },
                        });
                        await invalidateAuth();
                    }}
                />
            ) : null}
            <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
                <ProfileNav
                    navGroups={navGroups}
                    onLogout={isOwnProfile ? handleLogout : undefined}
                />
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
    onLogout?: () => void;
}) {
    const flatItems = navGroups.flatMap((g) => g.items);

    return (
        <>
            {/* Mobile: horizontal scroll */}
            {/* Ingen full-bleed her: scrollboksen følger innholdsbredden, så
                fanene holder seg i linje med resten av siden, og ScrollFade
                toner dem ut i kanten det finnes mer å scrolle til. */}
            <ScrollFade render={<nav />} className="md:hidden">
                <ul className="flex w-max gap-2">
                    {flatItems.map((item) => (
                        <li key={item.label} className="shrink-0">
                            <NavButton item={item} size="sm" />
                        </li>
                    ))}
                    {/* Også på mobil — ellers finnes det ingen vei ut av
                        kontoen på en telefon. */}
                    {onLogout ? (
                        <li className="shrink-0">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onLogout}
                            >
                                <LogOut />
                                Logg ut
                            </Button>
                        </li>
                    ) : null}
                </ul>
            </ScrollFade>

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
                    {onLogout ? (
                        <>
                            <Separator className="my-2" />
                            <Button
                                variant="ghost"
                                className="justify-start"
                                onClick={onLogout}
                            >
                                <LogOut />
                                Logg ut
                            </Button>
                        </>
                    ) : null}
                </nav>
            </aside>
        </>
    );
}
