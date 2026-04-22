import { Link, linkOptions, useMatches } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
} from "@tihlde/ui/ui/breadcrumb";
import { Button } from "@tihlde/ui/ui/button";
import { Separator } from "@tihlde/ui/ui/separator";
import { useSidebar } from "@tihlde/ui/ui/sidebar";
import { PanelLeftIcon } from "lucide-react";
import React, { useMemo } from "react";
import { ThemeSwitcher } from "./theme-switcher";

export function AdminLayoutHeader() {
    // const { auth } = useAuth(); -- Add auth later
    const auth = null;
    const { toggleSidebar } = useSidebar();
    const matches = useMatches();

    const crumbs = useMemo(() => {
        return matches.flatMap((match) => {
            const loaderData = match.loaderData;
            if (loaderData == null) return [];
            if (typeof loaderData !== "object") return [];
            if (!("breadcrumbs" in loaderData)) return [];
            const { breadcrumbs } = loaderData as { breadcrumbs?: unknown };
            if (typeof breadcrumbs !== "string") return [];

            return [
                {
                    label: breadcrumbs,
                    link: linkOptions({ to: match.pathname }),
                },
            ];
        });
    }, [matches]);

    return (
        <header className="flex sticky bg-sidebar top-0 z-10 h-14 border-b shadow-xs flex-none">
            <div className="flex w-full items-center gap-1 px-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="-ml-1 size-7"
                >
                    <PanelLeftIcon className="size-5" />
                </Button>
                <Separator
                    orientation="vertical"
                    className="mr-2 h-4 data-[orientation=vertical]:self-center data-[orientation=vertical]:h-4"
                />
                <Breadcrumb>
                    <BreadcrumbList>
                        {crumbs.map((v, i) => (
                            <React.Fragment key={v.label + i}>
                                <BreadcrumbItem>
                                    <BreadcrumbLink
                                        render={<Link {...v.link} />}
                                        className="text-foreground"
                                    >
                                        {v.label}
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                {i < crumbs.length - 1 && (
                                    <BreadcrumbSeparator />
                                )}
                            </React.Fragment>
                        ))}
                    </BreadcrumbList>
                </Breadcrumb>
                <div className="ml-auto flex items-center gap-4">
                    <ThemeSwitcher />
                    <Link to="/profil/me">
                        <Avatar>
                            <AvatarImage
                                alt={auth?.user?.firstName}
                                src={auth?.user?.image ?? ""}
                            />
                            <AvatarFallback>
                                {auth?.user?.firstName?.charAt(0)}
                                {auth?.user?.lastName?.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                    </Link>
                </div>
            </div>
        </header>
    );
}
