import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Github, Linkedin, Mail, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { DetailHeader } from "#/components/detail-layout";

export type ProfileLink = {
    kind: "github" | "linkedin";
    label: string;
};

export type ProfileHeaderUser = {
    name: string;
    username: string;
    email: string;
    programme: string;
    avatarUrl?: string;
    links: ProfileLink[];
};

type ProfileHeaderProps = {
    user: ProfileHeaderUser;
    actions?: ReactNode;
};

export function ProfileHeader({ user, actions }: ProfileHeaderProps) {
    return (
        <DetailHeader
            avatar={
                <Avatar className="size-16 shrink-0 md:row-span-3 md:aspect-square md:h-full md:max-h-32 md:w-auto">
                    {user.avatarUrl ? (
                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                    ) : null}
                    <AvatarFallback className="text-2xl">
                        {initials(user.name)}
                    </AvatarFallback>
                </Avatar>
            }
            title={
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl">{user.name}</h1>
                    <a
                        href={`mailto:${user.email}`}
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground md:hidden"
                    >
                        <Mail className="size-3.5" />
                        {user.email}
                    </a>
                </div>
            }
            subtitle={
                <p className="text-sm text-muted-foreground">
                    <span className="md:hidden">{user.programme}</span>
                    <span className="hidden md:inline">
                        {user.username} · {user.email} · {user.programme}
                    </span>
                </p>
            }
            badges={
                <>
                    {user.links.map((link) => (
                        <Badge
                            key={link.kind}
                            variant="outline"
                            className="hidden gap-1.5 md:flex"
                        >
                            {link.kind === "github" ? <Github /> : <Linkedin />}
                            {link.label}
                        </Badge>
                    ))}
                    <Badge
                        variant="secondary"
                        className="hidden gap-1.5 md:flex"
                    >
                        <Plus />
                        add link
                    </Badge>
                </>
            }
            actions={actions}
        />
    );
}

function initials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("");
}
