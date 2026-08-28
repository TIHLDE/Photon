import { Link, useRouterState } from "@tanstack/react-router";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@tihlde/ui/ui/accordion";
import { Badge } from "@tihlde/ui/ui/badge";
import { BottomBar, BottomBarItem } from "@tihlde/ui/ui/bottom-bar";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@tihlde/ui/ui/drawer";
import {
    BriefcaseBusiness,
    Calendar,
    Menu,
    SquareArrowOutUpRight,
} from "lucide-react";
import { useState } from "react";

import { loginSearchFor } from "#/api/auth";

import { TihldeLogo } from "./icons/tihlde";
import type { NavItem, NavLink } from "./site-header";

type SiteBottomBarProps = {
    navItems: NavItem[];
    isAuthenticated: boolean;
    /**
     * Setter en prikk på menyen og på «Min profil». Headeren merker avataren
     * på samme grunnlag, men den er skjult under lg — uten dette ville
     * påminnelsen forsvunnet for alle på mobil.
     */
    hasProfileTodo?: boolean;
};

export function SiteBottomBar({
    navItems,
    isAuthenticated,
    hasProfileTodo = false,
}: SiteBottomBarProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const closeMenu = () => setMenuOpen(false);
    const currentHref = useRouterState({
        select: (state) => state.location.href,
    });

    return (
        <BottomBar className="lg:hidden">
            <div className="flex items-stretch justify-between gap-1 px-2 py-1">
                <BottomBarItem
                    render={<Link to="/" activeOptions={{ exact: true }} />}
                >
                    <div className="size-5">
                        <TihldeLogo />
                    </div>
                    Hjem
                </BottomBarItem>

                <BottomBarItem render={<Link to="/arrangementer" />}>
                    <Calendar />
                    Arrangementer
                </BottomBarItem>

                <BottomBarItem render={<Link to="/annonser" />}>
                    <BriefcaseBusiness />
                    Stillinger
                </BottomBarItem>

                <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
                    <DrawerTrigger asChild>
                        <BottomBarItem
                            aria-label="Åpne meny"
                            className="relative"
                        >
                            {hasProfileTodo ? (
                                <Badge
                                    className="absolute top-1 right-2 size-2.5 p-0"
                                    aria-hidden
                                />
                            ) : null}
                            <Menu />
                            Meny
                        </BottomBarItem>
                    </DrawerTrigger>
                    <DrawerContent>
                        <DrawerHeader className="flex flex-row items-center gap-2">
                            <div className="size-7">
                                <TihldeLogo />
                            </div>
                            <DrawerTitle>Meny</DrawerTitle>
                        </DrawerHeader>

                        {/* min-h-0 lets the list actually scroll inside the
                            drawer's max height instead of being clipped. */}
                        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 pb-8">
                            {navItems.map((item) =>
                                item.kind === "group" ? (
                                    <Accordion key={item.label}>
                                        <AccordionItem
                                            value={item.label}
                                            className="border-none"
                                        >
                                            <AccordionTrigger>
                                                {item.label}
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="flex flex-col pl-2">
                                                    {item.items.map((sub) => (
                                                        <MenuLink
                                                            key={sub.label}
                                                            link={sub}
                                                            onNavigate={
                                                                closeMenu
                                                            }
                                                        />
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                ) : (
                                    <MenuLink
                                        key={item.label}
                                        link={item}
                                        onNavigate={closeMenu}
                                    />
                                ),
                            )}

                            {isAuthenticated ? (
                                <MenuLink
                                    link={{
                                        kind: "internal",
                                        label: "Min profil",
                                        link: {
                                            to: "/profil/$id",
                                            params: { id: "me" },
                                        },
                                    }}
                                    onNavigate={closeMenu}
                                    hasTodo={hasProfileTodo}
                                />
                            ) : (
                                <MenuLink
                                    link={{
                                        kind: "internal",
                                        label: "Logg inn",
                                        link: {
                                            to: "/login",
                                            // Tilbake hit etterpå, ikke på
                                            // forsiden — baren står også på
                                            // innloggingssidene, og der gir
                                            // hjelperen ingen destinasjon.
                                            search: loginSearchFor(currentHref),
                                        },
                                    }}
                                    onNavigate={closeMenu}
                                />
                            )}
                        </div>
                    </DrawerContent>
                </Drawer>
            </div>
        </BottomBar>
    );
}

function MenuLink({
    link,
    onNavigate,
    hasTodo = false,
}: {
    link: NavLink;
    onNavigate: () => void;
    hasTodo?: boolean;
}) {
    if (link.kind === "external") {
        return (
            <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 py-2"
                onClick={onNavigate}
            >
                {link.label}
                <SquareArrowOutUpRight className="size-3.5" aria-hidden />
            </a>
        );
    }

    return (
        <Link
            {...link.link}
            className="flex items-center gap-2 py-2"
            onClick={onNavigate}
        >
            {link.label}
            {hasTodo ? <Badge className="size-2.5 p-0" aria-hidden /> : null}
        </Link>
    );
}
