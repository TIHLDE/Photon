import { useNavigate, type LinkOptions } from "@tanstack/react-router";
import { useHotkey } from "@tanstack/react-hotkeys";
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
import {
    Briefcase,
    CalendarDays,
    Home,
    Newspaper,
    Tv,
    User,
    Users,
} from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

type CommandAction =
    | { kind: "navigate"; link: LinkOptions }
    | { kind: "external"; href: string }
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
};

const SECTIONS: CommandSection[] = [
    {
        heading: "Navigasjon",
        items: [
            {
                id: "home",
                label: "Hjem",
                icon: <Home />,
                keywords: ["forside", "start"],
                action: { kind: "navigate", link: { to: "/" } },
            },
            {
                id: "events",
                label: "Arrangementer",
                icon: <CalendarDays />,
                keywords: ["events"],
                action: { kind: "navigate", link: { to: "/arrangementer" } },
            },
            {
                id: "news",
                label: "Nyheter",
                icon: <Newspaper />,
                keywords: ["news"],
                action: { kind: "navigate", link: { to: "/nyheter" } },
            },
            {
                id: "groups",
                label: "Grupper",
                icon: <Users />,
                action: { kind: "navigate", link: { to: "/grupper" } },
            },
            {
                id: "jobs",
                label: "Stillinger",
                icon: <Briefcase />,
                keywords: ["annonser", "jobs"],
                action: { kind: "navigate", link: { to: "/annonser" } },
            },
            {
                id: "toddel",
                label: "TÖDDEL",
                icon: <Tv />,
                action: { kind: "navigate", link: { to: "/toddel" } },
            },
        ],
    },
    {
        heading: "Konto",
        items: [
            {
                id: "profile",
                label: "Min profil",
                icon: <User />,
                keywords: ["profil", "meg"],
                action: { kind: "navigate", link: { to: "/profil" } },
            },
        ],
    },
];

export function CommandMenu() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

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
                    {SECTIONS.map((section, index) => (
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
