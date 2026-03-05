import { Link, useRouter } from "@tanstack/react-router";
import { LogIn, LogOut, Moon, Sun, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useOptionalAuth } from "~/hooks/use-auth";
import { useTheme } from "~/hooks/use-theme";

const NAV_ITEMS = [
    { label: "Arrangementer", to: "/arrangementer" },
    { label: "Nyheter", to: "/nyheter" },
    { label: "Stillingsannonser", to: "/stillingsannonser" },
    { label: "Grupper", to: "/grupper" },
];

export function Topbar() {
    const [scrolled, setScrolled] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const session = useOptionalAuth();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className={`fixed top-0 right-0 left-0 z-50 hidden h-16 items-center transition-colors duration-200 md:flex ${
                scrolled
                    ? "border-b border-border bg-background/80 backdrop-blur-lg"
                    : "bg-transparent"
            }`}
        >
            <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6">
                <Link
                    to="/"
                    className="font-display text-xl font-bold uppercase tracking-wider"
                >
                    TIHLDE
                </Link>

                <div className="flex items-center gap-1">
                    {NAV_ITEMS.map((item) => (
                        <a
                            key={item.to}
                            href={item.to}
                            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {item.label}
                        </a>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        aria-label="Bytt tema"
                    >
                        {theme === "dark" ? (
                            <Sun className="size-4" />
                        ) : (
                            <Moon className="size-4" />
                        )}
                    </Button>

                    {session ? (
                        <UserMenu
                            name={session.user.name}
                            initials={getInitials(session.user.name)}
                        />
                    ) : (
                        <a href="/logg-inn">
                            <Button variant="outline" size="sm">
                                <LogIn className="size-4" />
                                Logg inn
                            </Button>
                        </a>
                    )}
                </div>
            </nav>
        </header>
    );
}

function UserMenu({ name, initials }: { name: string; initials: string }) {
    const { toggleTheme, theme } = useTheme();
    const router = useRouter();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className="rounded-full outline-none"
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                    />
                }
            >
                <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                        {initials}
                    </AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{name}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.navigate({ to: "/" })}>
                    <User className="size-4" />
                    Min profil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme}>
                    {theme === "dark" ? (
                        <Sun className="size-4" />
                    ) : (
                        <Moon className="size-4" />
                    )}
                    {theme === "dark" ? "Lyst tema" : "Mørkt tema"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => {
                        // TODO: call authClient.signOut() then invalidate
                        router.navigate({ to: "/" });
                    }}
                >
                    <LogOut className="size-4" />
                    Logg ut
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
}
