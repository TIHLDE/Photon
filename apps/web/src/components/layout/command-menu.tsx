import { useNavigate } from "@tanstack/react-router";
import { Briefcase, Calendar, Home, Newspaper, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "~/components/ui/command";

const PAGES = [
    { label: "Hjem", to: "/", icon: Home },
    { label: "Arrangementer", to: "/arrangementer", icon: Calendar },
    { label: "Nyheter", to: "/nyheter", icon: Newspaper },
    { label: "Stillingsannonser", to: "/stillingsannonser", icon: Briefcase },
    { label: "Grupper", to: "/grupper", icon: Users },
] as const;

export function CommandMenu() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    const goTo = useCallback(
        (to: string) => {
            setOpen(false);
            navigate({ to });
        },
        [navigate],
    );

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Søk etter sider..." />
            <CommandList>
                <CommandEmpty>Ingen resultater.</CommandEmpty>
                <CommandGroup heading="Sider">
                    {PAGES.map((page) => (
                        <CommandItem
                            key={page.to}
                            onSelect={() => goTo(page.to)}
                        >
                            <page.icon className="size-4" />
                            {page.label}
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
