import { Badge } from "@tihlde/ui/ui/badge";
import { Github, Linkedin, Plus } from "lucide-react";

import type { ProfileLink } from "#/components/profile-header";

type ProfileLinksSectionProps = {
    links: ProfileLink[];
};

export function ProfileLinksSection({ links }: ProfileLinksSectionProps) {
    return (
        <div className="flex flex-col gap-3 md:hidden">
            <h3 className="text-xs text-muted-foreground">LENKER</h3>
            <div className="flex flex-wrap items-center gap-2">
                {links.map((link) => (
                    <Badge
                        key={link.kind}
                        variant="outline"
                        className="gap-1.5"
                    >
                        {link.kind === "github" ? <Github /> : <Linkedin />}
                        {link.label}
                    </Badge>
                ))}
                <Badge variant="secondary" className="gap-1.5">
                    <Plus />
                    add link
                </Badge>
            </div>
        </div>
    );
}
