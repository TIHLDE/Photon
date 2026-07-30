import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Github, GraduationCap, Linkedin, Mail, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { DetailHeader } from "#/components/detail-layout";
import { initials } from "#/lib/utils";

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
    /**
     * Åpner dialogen der GitHub-/LinkedIn-lenker redigeres. Utelates på andres
     * profiler, som også skjuler «Legg til lenke».
     */
    onAddLink?: () => void;
};

export function ProfileHeader({
    user,
    actions,
    onAddLink,
}: ProfileHeaderProps) {
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
                    {onAddLink ? (
                        <Badge
                            variant="secondary"
                            className="gap-1.5"
                            render={
                                <button type="button" onClick={onAddLink} />
                            }
                        >
                            <Plus />
                            Legg til lenke
                        </Badge>
                    ) : null}
                </>
            }
            actions={actions}
        />
    );
}
