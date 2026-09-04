import { useQuery } from "@tanstack/react-query";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate, type LinkOptions } from "@tanstack/react-router";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@tihlde/ui/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import {
    BookOpenIcon,
    BookOpenTextIcon,
    BriefcaseIcon,
    BugIcon,
    CalendarDaysIcon,
    ChartCandlestickIcon,
    GitBranchIcon,
    HomeIcon,
    LockKeyholeIcon,
    NewspaperIcon,
    ShieldCheckIcon,
    UserIcon,
    UsersIcon,
} from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { authQueryOptions } from "#/api/auth";
import { useIsAdmin } from "#/hooks/use-permission";
import { avatarImageUrl } from "#/lib/assets";

type CommandAction =
    | { kind: "navigate"; link: LinkOptions }
    | { kind: "external"; href: string; target?: HTMLAnchorElement["target"] }
    | { kind: "callback"; run: () => void };

type CommandEntry = {
    id: string;
    label: string;
    hint?: string;
    icon?: ReactNode;
    keywords?: string[];
    action: CommandAction;
};

type CommandSection = {
    heading: string;
    items: CommandEntry[];
    /** Only shown to admins. The section is hidden entirely otherwise. */
    requiresAdmin?: boolean;
};

const SECTIONS: CommandSection[] = [
    {
        heading: "Navigasjon",
        items: [
            {
                id: "home",
                label: "Hjem",
                icon: <HomeIcon />,
                keywords: ["forside", "start"],
                action: { kind: "navigate", link: { to: "/" } },
            },
            {
                id: "events",
                label: "Arrangementer",
                icon: <CalendarDaysIcon />,
                keywords: ["events"],
                action: { kind: "navigate", link: { to: "/arrangementer" } },
            },
            {
                id: "news",
                label: "Nyheter",
                icon: <NewspaperIcon />,
                keywords: ["news"],
                action: { kind: "navigate", link: { to: "/nyheter" } },
            },
            {
                id: "groups",
                label: "Grupper",
                icon: <UsersIcon />,
                action: { kind: "navigate", link: { to: "/grupper" } },
            },
            {
                id: "jobs",
                label: "Stillinger",
                icon: <BriefcaseIcon />,
                keywords: ["annonser", "jobs"],
                action: { kind: "navigate", link: { to: "/annonser" } },
            },
            {
                id: "toddel",
                label: "TÖDDEL",
                icon: <BookOpenIcon />,
                action: { kind: "navigate", link: { to: "/toddel" } },
            },
            {
                id: "bugs",
                label: "Bugs og Tilbakemeldinger",
                icon: <BugIcon />,
                keywords: ["bugs", "ide", "problem"],
                action: { kind: "navigate", link: { to: "/tilbakemelding" } },
            },
            {
                id: "kokebok",
                label: "Kokebok",
                keywords: ["øvinger", "oppgaver"],
                action: { kind: "navigate", link: { to: "/kokebok" } },
            },
            {
                id: "privacy",
                label: "Personvern",
                icon: <LockKeyholeIcon />,
                keywords: ["privacy", "personvern"],
                action: { kind: "navigate", link: { to: "/personvern" } },
            },
        ],
    },
    {
        heading: "Eksterne Sider",
        items: [
            {
                id: "wiki",
                label: "Wiki",
                icon: <BookOpenTextIcon />,
                keywords: ["info"],
                action: {
                    kind: "external",
                    href: "https://wiki.tihlde.org",
                    target: "_blank",
                },
            },
            {
                id: "github",
                label: "GitHub",
                icon: <GitBranchIcon />,
                keywords: ["kode", "prosjekter"],
                action: {
                    kind: "external",
                    href: "https://github.com/TIHLDE",
                    target: "_blank",
                },
            },
            {
                id: "fondet",
                label: "Fondet",
                icon: <ChartCandlestickIcon />,
                keywords: ["fondet", "økonomi"],
                action: {
                    kind: "external",
                    href: "https://fondet.tihlde.org",
                    target: "_blank",
                },
            },
            {
                id: "kontres",
                label: "Kontres",
                keywords: ["reservere", "utstyr"],
                action: {
                    kind: "external",
                    href: "https://kontres.tihlde.org",
                    target: "_blank",
                },
            },
        ],
    },
    {
        heading: "Konto",
        items: [
            {
                id: "profile",
                label: "Min profil",
                icon: <UserIcon />,
                keywords: ["profil", "meg"],
                action: {
                    kind: "navigate",
                    link: { to: "/profil/$id", params: { id: "me" } },
                },
            },
        ],
    },
    {
        heading: "Administrasjon",
        requiresAdmin: true,
        items: [
            {
                id: "dashboard",
                label: "Admin Dashboard",
                icon: <ShieldCheckIcon />,
                keywords: ["admin", "dashboard"],
                action: { kind: "navigate", link: { to: "/admin" } },
            },
        ],
    },
];

export function CommandMenu() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const isAdmin = useIsAdmin();
    const { data: session } = useQuery(authQueryOptions);

    const sections = useMemo(() => {
        const sections = SECTIONS.filter(
            (section) => !section.requiresAdmin || isAdmin,
        );

        if ((session?.groups?.length ?? 0) > 0) {
            sections.push({
                heading: "Mine Grupper",
                items:
                    session?.groups.map((group) => ({
                        id: `group-${group.slug}`,
                        label: group.name,
                        icon: (
                            <Avatar className="size-5 shrink-0 [&_svg]:size-3.5">
                                {group.logoUrl ? (
                                    <AvatarImage
                                        src={avatarImageUrl(group.logoUrl)}
                                        alt=""
                                    />
                                ) : null}
                                <AvatarFallback>
                                    <UsersIcon />
                                </AvatarFallback>
                            </Avatar>
                        ),
                        action: {
                            kind: "navigate",
                            link: {
                                to: "/grupper/$slug",
                                params: { slug: group.slug },
                            },
                        },
                    })) ?? [],
            });
        }

        return sections;
    }, [isAdmin, session]);

    useHotkey("Mod+K", () => {
        setOpen((prev) => !prev);
    });

    const runAction = useCallback(
        (action: CommandAction) => {
            setOpen(false);
            if (action.kind === "navigate") {
                navigate(action.link);
            } else if (action.kind === "external") {
                window.open(action.href, "_blank", "noopener,noreferrer");
            } else {
                action.run();
            }
        },
        [navigate],
    );

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <Command>
                <CommandInput placeholder="Søk etter en side eller handling..." />
                <CommandList>
                    <CommandEmpty>Ingen treff.</CommandEmpty>
                    {sections.map((section, index) => (
                        <SectionBlock
                            key={section.heading}
                            section={section}
                            showSeparator={index > 0}
                            onRun={runAction}
                        />
                    ))}
                </CommandList>
            </Command>
        </CommandDialog>
    );
}

function SectionBlock({
    section,
    showSeparator,
    onRun,
}: {
    section: CommandSection;
    showSeparator: boolean;
    onRun: (action: CommandAction) => void;
}) {
    return (
        <>
            {showSeparator ? <CommandSeparator /> : null}
            <CommandGroup heading={section.heading}>
                {section.items.map((item) => (
                    <CommandItem
                        key={item.id}
                        value={[item.label, ...(item.keywords ?? [])].join(" ")}
                        onSelect={() => onRun(item.action)}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                        {item.hint ? (
                            <CommandShortcut>{item.hint}</CommandShortcut>
                        ) : null}
                    </CommandItem>
                ))}
            </CommandGroup>
        </>
    );
}
