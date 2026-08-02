import { Link } from "@tanstack/react-router";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@tihlde/ui/ui/accordion";
import { BottomBar, BottomBarItem } from "@tihlde/ui/ui/bottom-bar";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@tihlde/ui/ui/drawer";
import { BriefcaseBusiness, Calendar, Menu } from "lucide-react";
import { useState } from "react";

import { TihldeLogo } from "./icons/tihlde";
import type { NavItem, NavLink } from "./site-header";

type SiteBottomBarProps = {
    navItems: NavItem[];
    isAuthenticated: boolean;
};

export function SiteBottomBar({
    navItems,
    isAuthenticated,
}: SiteBottomBarProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const closeMenu = () => setMenuOpen(false);

    return (
        <BottomBar className="md:hidden">
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
                        <BottomBarItem aria-label="Åpne meny">
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
                                />
                            ) : (
                                <MenuLink
                                    link={{
                                        kind: "internal",
                                        label: "Logg inn",
                                        link: { to: "/login" },
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
}: {
    link: NavLink;
    onNavigate: () => void;
}) {
    if (link.kind === "external") {
        return (
            <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2"
                onClick={onNavigate}
            >
                {link.label}
            </a>
        );
    }

    return (
        <Link {...link.link} className="py-2" onClick={onNavigate}>
            {link.label}
        </Link>
    );
}
