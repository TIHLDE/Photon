import { Link, type LinkOptions } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@tihlde/ui/ui/navigation-menu";
import { ExternalLinkIcon, User } from "lucide-react";

import { ThemeSwitcher } from "./theme-switcher";

export type InternalLink = {
    kind: "internal";
    label: string;
    link: LinkOptions;
    description?: string;
};

export type ExternalLink = {
    kind: "external";
    label: string;
    href: string;
    description?: string;
};

export type NavLink = InternalLink | ExternalLink;

export type NavGroup = {
    kind: "group";
    label: string;
    items: NavLink[];
};

export type NavItem = NavLink | NavGroup;

type SiteHeaderProps = {
    navItems: NavItem[];
    user?: { name: string; avatarUrl?: string } | null;
};

export function SiteHeader({ navItems, user }: SiteHeaderProps) {
    return (
        <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur">
            <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
                <Link to="/" className="flex items-center gap-2">
                    <div className="size-8 rounded-md bg-muted" aria-hidden />
                    <span className="text-sm">TIHLDE</span>
                </Link>

                <NavigationMenu className="hidden md:flex">
                    <NavigationMenuList>
                        {navItems.map((item) =>
                            item.kind === "group" ? (
                                <NavigationMenuItem key={item.label}>
                                    <NavigationMenuTrigger>
                                        {item.label}
                                    </NavigationMenuTrigger>
                                    <NavigationMenuContent>
                                        <ul className="grid w-fit max-w-xl grid-cols-3 gap-2 p-4">
                                            {item.items.map((sub) => (
                                                <li key={sub.label}>
                                                    <NavigationMenuLink
                                                        render={renderLink(sub)}
                                                        closeOnClick={true}
                                                    >
                                                        <div className="relative flex flex-col gap-1">
                                                            <span className="font-medium">
                                                                {sub.label}
                                                            </span>
                                                            {sub.description ? (
                                                                <span className="text-muted-foreground">
                                                                    {
                                                                        sub.description
                                                                    }
                                                                </span>
                                                            ) : null}
                                                            {sub.kind ===
                                                            "external" ? (
                                                                <ExternalLinkIcon
                                                                    className="absolute top-0 right-0 size-4"
                                                                    aria-hidden
                                                                />
                                                            ) : null}
                                                        </div>
                                                    </NavigationMenuLink>
                                                </li>
                                            ))}
                                        </ul>
                                    </NavigationMenuContent>
                                </NavigationMenuItem>
                            ) : (
                                <NavigationMenuItem key={item.label}>
                                    <NavigationMenuLink
                                        render={renderLink(item)}
                                    >
                                        {item.label}
                                    </NavigationMenuLink>
                                </NavigationMenuItem>
                            ),
                        )}
                    </NavigationMenuList>
                </NavigationMenu>

                <div className="flex items-center gap-2">
                    <ThemeSwitcher />
                    <Link
                        to={user ? "/profil/me" : "/login"}
                        aria-label={user ? "Gå til profil" : "Logg inn"}
                    >
                        <Avatar className="size-8">
                            {user?.avatarUrl ? (
                                <AvatarImage
                                    src={user.avatarUrl}
                                    alt={user.name}
                                    // Make picture funny by squashing the image :)
                                    className="object-fill"
                                />
                            ) : null}
                            <AvatarFallback>
                                {user ? getInitials(user.name) : <User />}
                            </AvatarFallback>
                        </Avatar>
                    </Link>
                </div>
            </div>
        </header>
    );
}

function renderLink(link: NavLink) {
    if (link.kind === "internal") {
        return <Link {...link.link} />;
    }

    return <a href={link.href} target="_blank" rel="noopener noreferrer" />;
}

function getInitials(name: string) {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.slice(0, 1).toUpperCase())
        .join("");
}
