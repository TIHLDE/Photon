import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Github, GraduationCap, Linkedin, Mail } from "lucide-react";
import type { ReactNode } from "react";

import { DetailHeader } from "#/components/detail-layout";
import { initials } from "#/lib/utils";

import { avatarImageUrl } from "#/lib/assets";

export type ProfileLink = {
    kind: "github" | "linkedin";
    label: string;
    url?: string;
};

export type ProfileHeaderUser = {
    name: string;
    /** Bare satt på egen profil — e-post er ikke en del av den offentlige profilen. */
    email?: string;
    programme?: string;
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
            // Fast størrelse, ikke `h-full`: bildet har en egen høyde som
            // blåser opp raden headeren strekker seg etter, så avataren ble
            // merkbart større idet et bilde ble lagt til.
            avatar={
                <Avatar className="size-16 shrink-0 md:row-span-3 md:size-24">
                    {user.avatarUrl ? (
                        <AvatarImage
                            src={avatarImageUrl(user.avatarUrl)}
                            alt={user.name}
                        />
                    ) : null}
                    <AvatarFallback className="text-2xl">
                        {initials(user.name)}
                    </AvatarFallback>
                </Avatar>
            }
            title={
                /* Navn, studie + klassetrinn og e-post stables vertikalt — én
                   opplysning per linje, i stedet for å slås sammen på én rad. */
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl">{user.name}</h1>
                    {user.programme ? (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <GraduationCap className="size-3.5 shrink-0" />
                            {user.programme}
                        </p>
                    ) : null}
                    {user.email ? (
                        <a
                            href={`mailto:${user.email}`}
                            className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
                        >
                            <Mail className="size-3.5 shrink-0" />
                            {user.email}
                        </a>
                    ) : null}
                </div>
            }
            badges={
                <>
                    {user.links.map((link) => (
                        <Badge
                            key={link.kind}
                            variant="outline"
                            className="gap-1.5"
                            render={
                                link.url ? (
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                    />
                                ) : undefined
                            }
                        >
                            {link.kind === "github" ? <Github /> : <Linkedin />}
                            {link.label}
                        </Badge>
                    ))}
                </>
            }
            actions={actions}
        />
    );
}
