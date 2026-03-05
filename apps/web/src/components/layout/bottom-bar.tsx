import { Briefcase, Calendar, Home, Menu, Newspaper } from "lucide-react";
import { useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "~/components/ui/sheet";

const QUICK_ITEMS = [
    { label: "Hjem", to: "/", icon: Home },
    { label: "Arrangement", to: "/arrangementer", icon: Calendar },
    { label: "Nyheter", to: "/nyheter", icon: Newspaper },
    { label: "Karriere", to: "/stillingsannonser", icon: Briefcase },
];

const FULL_NAV = [
    { label: "Hjem", to: "/" },
    { label: "Arrangementer", to: "/arrangementer" },
    { label: "Nyheter", to: "/nyheter" },
    { label: "Stillingsannonser", to: "/stillingsannonser" },
    { label: "Grupper", to: "/grupper" },
    { label: "Ny student", to: "/ny-student" },
    { label: "For bedrifter", to: "/bedrifter" },
];

export function BottomBar() {
    const [open, setOpen] = useState(false);

    return (
        <nav className="fixed right-0 bottom-0 left-0 z-50 flex h-16 items-center justify-around border-t border-border bg-background/95 backdrop-blur-sm md:hidden">
            {QUICK_ITEMS.map((item) => (
                <a
                    key={item.to}
                    href={item.to}
                    className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground transition-colors"
                >
                    <item.icon className="size-5" />
                    <span className="text-[10px] font-medium">
                        {item.label}
                    </span>
                </a>
            ))}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger>
                    <div className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground">
                        <Menu className="size-5" />
                        <span className="text-[10px] font-medium">Meny</span>
                    </div>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl">
                    <SheetHeader>
                        <SheetTitle className="font-display text-lg uppercase tracking-wider">
                            Meny
                        </SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-1 py-4">
                        {FULL_NAV.map((item) => (
                            <a
                                key={item.to}
                                href={item.to}
                                onClick={() => setOpen(false)}
                                className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                            >
                                {item.label}
                            </a>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>
        </nav>
    );
}
