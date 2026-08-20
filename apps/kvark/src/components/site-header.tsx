import { Link, type LinkOptions } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@tihlde/ui/ui/navigation-menu";
import { SquareArrowOutUpRight, User } from "lucide-react";
import type { ReactNode } from "react";

import { ThemeSwitcher } from "./theme-switcher";
import { TihldeLogo } from "./icons/tihlde";

import { avatarImageUrl } from "#/lib/assets";

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
    /**
     * Knapper som legges til venstre for temabryteren. En slot fordi headeren
     * ikke skal hente data selv — varselbjella gjør det, og hører hjemme i
     * layout-ruten.
     */
    actions?: ReactNode;
    /**
     * Setter en prikk på avataren. Brukes til allergispørsmålet, som blir
     * stående ubesvart til noen svarer — og et lite merke på profilen er den
     * eneste påminnelsen som ikke krever at man er inne på et arrangement.
     */
    hasProfileTodo?: boolean;
};

export function SiteHeader({
    navItems,
    user,
    actions,
    hasProfileTodo = false,
}: SiteHeaderProps) {
    return (
        <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur">
            <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
                <Link
                    to="/"
                    className="flex items-center"
                    style={{ color: "var(--color-logo, currentColor)" }}
                >
                    <TihldeLogo variant="full" className="h-5 w-auto" />
                </Link>

                <NavigationMenu className="hidden lg:flex">
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
                                                                <SquareArrowOutUpRight
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
                                        <span className="flex items-center gap-1">
                                            {item.label}
                                            {item.kind === "external" ? (
                                                <SquareArrowOutUpRight
                                                    className="size-3.5"
                                                    aria-hidden
                                                />
                                            ) : null}
                                        </span>
                                    </NavigationMenuLink>
                                </NavigationMenuItem>
                            ),
                        )}
                    </NavigationMenuList>
                </NavigationMenu>

                <div className="flex items-center gap-2">
                    {actions}
                    <ThemeSwitcher />
                    <Link
                        {...(user
                            ? { to: "/profil/$id", params: { id: "me" } }
                            : { to: "/login" })}
                        aria-label={
                            user
                                ? hasProfileTodo
                                    ? "Gå til profil. Du mangler å svare på om du har allergier."
                                    : "Gå til profil"
                                : "Logg inn"
                        }
                        className="relative flex items-center"
                    >
                        {hasProfileTodo ? (
                            <Badge
                                className="absolute -top-0.5 -right-0.5 z-10 size-2.5 p-0"
                                aria-hidden
                            />
                        ) : null}
                        <Avatar className="size-8">
                            {user?.avatarUrl ? (
                                <AvatarImage
                                    src={avatarImageUrl(user.avatarUrl)}
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
